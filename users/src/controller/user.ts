import { Request, Response, NextFunction, response, request } from 'express';
import bcrypt from 'bcryptjs';
import { ObjectId, WithId } from 'mongodb';
import database from '../database/user';
import user from '../interface/user'
import config from '../config/config';
import amqp from 'amqplib';

const verifyAccount = (req : Request, res : Response, next : NextFunction): Promise<Response> => { return database.validateUser(req, res); };

const register = async(req : Request, res : Response, next : NextFunction): Promise<Response> => {
    let {
        name,
        password,
        email,
        phone_number,
        confirmPassword,
        confirmEmail
    } = req.body
    
    const checkParameters = (user :user): boolean => {
        Object.values(user).every(value => {
            if(value === undefined) return true;
        });
        return false;
    }

    const parseNumber = (number : string) => {
        return number.replace('(', '').replace(')', '').replace('-', '');
    }
   
    const User: user = {
        _id : new ObjectId(),
        name : String(name).toLowerCase(),
        password : req.body.password,
        email : String(email).toLowerCase(),
        phone_number : parseNumber(phone_number),
        created : new Date(),
        verified : false,
    }
    if(checkParameters(User))
        res.status(403).json({
            message : 'One or more fields are empty'
        });

    if(password !== confirmPassword && email !== confirmEmail) { 
        return res.status(401).json({
            message : 'password or email do not match!',
        });
    }
    else {
        if(config.regex.email.test(email) && config.regex.password.test(password) && config.regex.phone.test(phone_number)) {
            bcrypt.hash(password, 10, async(err: Error, hash : string) => {
                if(err) {
                    return res.status(401).json({
                        message : 'Could not generate hash',
                        error : err
                    });
                }
                User.password = hash;  
            });

            return await database.addUser(req, res, User);
        } else {
            return res.status(500).json({
                message : 'your phone number, email, or password do not meet the required criteria'
            });
        }
    }
}

const login = (req : Request, res : Response, next : NextFunction) => {
    
}

const getAllUsers = (req : Request, res : Response, next : NextFunction) => {
    
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
    const id = String(req.query.id);
    const user = await database.getUserById(id);
    // console.log(user);
    if(user !== null) {
        type account = {
            name : string,
            email : string,
            phone_number : string
        };
        let acc :account = {
            name : req.body.name !== undefined ? req.body.name : user.name,
            email : req.body.email !== undefined ? req.body.email : user.email,
            phone_number : req.body.phone_number !== undefined ? req.body.phone_number : user.phone_number
        };

        database.updateAccount(id, acc);
        return res.status(200).json({
            message : 'profile was successfully updated'
        });
    }
    return res.status(500).json({
        message : 'invalid data was sent'
    });
}

export default { verifyAccount, register, login, getAllUsers, resetPassword, reset, updateUserInformation };