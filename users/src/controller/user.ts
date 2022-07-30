import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { Eureka } from 'eureka-js-client';
import { request } from '../request.helper';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import database from '../database/user';
import User from '../interfaces/user';
import Token from '../interfaces/token';
import Login from '../interfaces/login';
import config from '../config/config';
import token from '../middleware/verify';
import amqp from 'amqplib';
import eureka from '../eureka-helper';
let client: Eureka;

setTimeout(() => {
    client = eureka.registerService('users', Number.parseInt(config.server.port));
}, 15000);

const parseNumber = (number : string) => {
    return number.replace('(', '').replace(')', '').replace('-', '').replace('-', '');
}

const getMeters = (miles: number) => {
    return miles * 1609.344;
}

const verifyAccount = (req : Request, res : Response, next : NextFunction): Promise<Response> => { return database.validateUser(req, res); };

const validateLocation = async(user: User): Promise<User> => {
    const response = await request('http://gateway:8080/events/validatelocation', 'post', undefined, { user : user });
    if(response === null)
        return user;
    return response.data as User;
}

const register = async(req : Request, res : Response, next : NextFunction): Promise<Response> => {
    let {
        name,
        password,
        email,
        bio,
        phone_number,
        confirmPassword,
        confirmEmail, 
        location
    } = req.body
    
    const checkParameters = (user :User): boolean => {
        Object.values(user).every(value => {
            if(value === undefined) return true;
        });
        return false;
    }

    const date = new Date();

    let User: User = {
        _id : new ObjectId(),
        name : String(name).toLowerCase(),
        password : String(req.body.password),
        email : String(email).toLowerCase(),
        phone_number : parseNumber(phone_number),
        bio : String(bio),
        base_location : {
            city : String(location),
            coords : [],
            distance : getMeters(50)
        },
        follow_list : [],
        follower_count : 0,
        created : new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        verified : false,
    };

    User = await validateLocation(User);
    User._id = new ObjectId(User._id);

    if(checkParameters(User))
        res.status(403).json({
            message : 'one or more fields are empty'
        });


    if(password !== confirmPassword && email !== confirmEmail) { 
        return res.status(401).json({
            message : 'password or email do not match!',
        });
    } else {
        if(config.regex.email.test(email) && config.regex.password.test(password) && config.regex.phone.test(phone_number)) {
            const hash = await bcrypt.hash(password, 10);
            User.password = hash;
            return await database.addUser(req, res, User);
        } else {
            return res.status(500).json({
                message : 'your phone number, email, or password do not meet the required criteria'
            });
        }
    }
}

const login = async(req : Request, res : Response): Promise<Response> => {
    let login: Login = {
        username : String(req.body.username),
        password : String(req.body.password),
    };

    //role based authorization strats
    if(config.regex.email.test(login.username)) {
        if(await database.getEmail(login.username)) {
            const user = await database.getUserByEmail(login.username) as User;
            if(user !== undefined && bcrypt.compareSync(login.password, user.password)) {
                const token = jwt.sign({ id : String(user._id)}, config.server.token.secret, { expiresIn : 60 * 60 });
                req.headers['authorization'] = token;
                return res.status(200).json({
                    message : 'signed in',
                    token : token
                });
            }
        } else 
            return res.status(401).json('A wrong username or password was wrong. Please try again'); 
    } else if(config.regex.phone.test(login.username)) {
        if(await database.getPhone(parseNumber(login.username))) {
            const user = await database.getPhone(parseNumber(login.username)) as User;
            console.log('user', user);
            console.log(bcrypt.compareSync(login.password, user.password));
            if(user !== undefined && bcrypt.compareSync(login.password, user.password)) {
                const token = jwt.sign({ id : String(user._id)}, config.server.token.secret, { expiresIn : 60 * 60 });
                req.headers['authorization'] = token;
                return res.status(200).json({
                    message : 'signed in',
                    token : token
                });
            }
        } else 
            return res.status(401).json('A wrong username or password was wrong. Please try again'); 
    } 
    return res.status(401).json('A wrong username or password was wrong. Please try again');
    
}

const getAllUsers = async(req : Request, res : Response) => {
    return res.status(200).json(await database.getAllUsers());
}

const resetPassword = async(req : Request, res : Response): Promise<Response> => {
    let username = req.body || '';
    if(username === '')
        return res.status(401).json({
            message : 'the username you sent was empty'
        });
    let account = await database.getUserByEmail(username.username);
    if(account !== undefined) {
        const url = config.server.queue || 'amqp://localhost';
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();

        channel.assertQueue('reset password', {durable : false});
        let link = 'http://' + req.get('host') + '/reset?id=' + account._id;

        let options = {
            to : account.email,
            from : '',
            subject : 'reset password',
            html : 'Hello, <br> Please click the link to reset your password.<br><a href=' + link + '>Click here to reset your password</a>'
        };
        
        channel.sendToQueue('reset password', Buffer.from(JSON.stringify(options)));

        return res.status(200).json({
            message : 'please check your email to reset your password'
        })
    } else {
        return res.status(401).json({
            message : 'the username you entered does not exist'
        });
    }
}

const reset = async(req : Request, res : Response): Promise<Response> => {
    return database.resetPassword(req, res);
}

const updateUserInformation = async(req : Request, res : Response): Promise<Response> => {
    const id = new ObjectId(String(req.query.id));
    const user = await database.getUserById(id);
    if(user === null) 
        return res.status(500).json({
            message : 'invalid data was sent'
        });

    let newUser: User = {
        _id : user._id,
        name : req.body.name !== undefined ? req.body.name : user.name,
        password : user.password,
        email : req.body.email !== undefined ? req.body.email : user.email,
        phone_number : req.body.phone_number !== undefined ? req.body.phone_number : user.phone_number,
        bio : req.body.bio !== undefined ? req.body.bio : user.bio,
        base_location : {
            city : req.body.city !== undefined ? req.body.city : user.base_location.city,
            coords : user.base_location.coords,
            distance : req.body.distance !== undefined ? getMeters(Number.parseInt(req.body.distance)) : user.base_location.distance
        },
        follow_list : user.follow_list,
        follower_count : user.follower_count,
        created : user.created,
        verified : req.body.email === undefined ? user.verified : false
    };

    if(req.body.city !== null)
        newUser = await validateLocation(newUser);

    await database.updateAccount(user._id, newUser);
    if(newUser.email === user.email) 
        return res.status(200).json({
            message : 'profile was successfully updated'
        });
    
    const sendToQueue = async(req : Request) => {
        const url = config.server.queue || 'amqp://localhost';
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();
        await channel.assertQueue('verify account', {durable : true});
        let link = 'http://' + req.get('host') + '/verify?id=' + user._id.toHexString();
    
        let options = {
            from : '',
            to : user.email,
            subject : 'Social Butterfly Account Verification',
            html : 'Hello, <br> Please Click on the link to verify your account. <br><a href=' + link + '>Click here to verify your account</a>'
        };

        channel.sendToQueue('verify account', Buffer.from(JSON.stringify(options)));
    };

    await sendToQueue(req);

    await request('http://gateway:8080/events/updateEvent', 'patch', undefined, { newEmail : newUser.email, oldEmail : user.email });
    return res.status(200).json('profile was successfully updated');
}

const addFollower = async(req: Request, res: Response): Promise<Response> => {
    const id = new ObjectId(String(req.query.id));
    const user: Token = token.getToken(req);

    return await database.addFollower(id, user, res);
}

const removeFollower = async(req: Request, res: Response): Promise<Response> => {
    const id = new ObjectId(String(req.query.id));
    const user: Token = token.getToken(req);
    return await database.removeFollower(id, user, res);
}

const getUser = async(req: Request, res: Response): Promise<Response> => {
    console.log(req.query.id);
    return res.status(200).json({ data :  await database.getUserById(new ObjectId(String(req.query.id))) });
}

const userByEmail = async(req: Request, res: Response): Promise<Response> => {return res.status(200).json(await database.getUserByEmail(req.body.email));}

export default { verifyAccount, register, login, getAllUsers, resetPassword, reset, updateUserInformation, addUser: addFollower, removeUser: removeFollower, getUser, userByEmail };