import { Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import config from '../config/config';
import user from '../interfaces/user';
import token from '../interfaces/token';
import { request } from '../request.helper';
import jwt from 'jsonwebtoken';

const client = new MongoClient(config.mongo.url, config.mongo.options);
client.connect();

const db = client.db(config.mongo.database);
const collections = {
    users : db.collection(config.mongo.collections.MONGO_USERS),
    tokens : db.collection(String(config.mongo.collections.tokens))
};

/*
    adds user to the database and sends them an email to verify their account
*/
const addUser = async(req : Request, res: Response, user: user): Promise<Response> => {
    if(!user) {
        return res.status(500).json({
            error : 'no user was sent'
        });
    } else if((await collections.users.find({ $or : [{email : user.email}, {phone_number : user.phone_number}] }).toArray()).length !== 0) {
        return res.status(500).json({
            message : 'that email already exists or phone number already exists'
        });
    } else {
        await collections.users.insertOne(user);
        const link = 'http://' + req.get('host') + '/verify?id=' + user._id.toHexString();
        const html = 'Hello, <br> Please Click on the link to verify your account. <br><a href=' + link + '>Click here to verify your account</a>'
        request('http://gateway:8080/consumer/sendmail', 'post', undefined, {
            from : '',
            to: user.email,
            subject: 'Social Butterfly Account Activation',
            html: html
        });
        return res.status(200).json({
            user
        });
    }
}

const getUser = async(id: ObjectId): Promise<user> => {
    const user = await collections.users.find({ _id : id }).toArray() as user[];
    return user[0];
}

const addFollower = async(id: ObjectId, token: token, res: Response): Promise<Response> => {
    const user = await getUser(token.id);
    if(await collections.users.findOne({follow_list : user.email}))
        return res.status(401).json('this account already follows this user');
    else  {
        await collections.users.updateOne({ _id : id }, { $push : {follow_list : user.email }, $inc : { follower_count : 1 }});
        const result = await collections.users.find({_id : id}).toArray() as user[];
        return res.status(200).json({
            status : 'user added to follower list',
            follow_list : result[0].follow_list
        });
    }
}

const removeFollower = async(id: ObjectId, token: token, res: Response): Promise<Response> => {
    const user = await getUser(token.id);
    if(user.follow_list.includes(user.email)) {
        await collections.users.updateOne({ _id : id }, { $pull : { follow_list : user.email }, $inc : { follower_count : -1 }});
        const results = await collections.users.find({_id : id }).toArray() as user[];
        const list = results[0].follow_list;
        return res.status(200).json({
            message : 'user was removed',
            list
        });
    } else 
        return res.status(401).json('you didn\'t follow this user');
}

// when the user clicks on the link in their email it will verify their account
const validateUser = async(req : Request, res : Response): Promise<Response> => { 
    let id = new ObjectId(String(req.query.id));
    if(id === undefined) return res.status(500).json({
        error : 'the id was empty. please try again'
    });

    await collections.users.updateOne({ _id : id}, {$set : { verified : true }}); 
    return res.status(200).json({ id : id, 
        message : 'the user was authorized'});
}

//returns true or false if the email exists in the database
const checkEmail = async(email : string): Promise<boolean> => {
    if(await collections.users.findOne({email : email}))
        return true;
    return false;
}

const getUserById = async(id: ObjectId): Promise<user> => {
    return await collections.users.findOne({ _id : id }) as user;
}

const getUserByEmail = async(email : string) => {
    let user = await collections.users.findOne({email : email});
    if(user)
        return user;
    return undefined;
}

// resets the user's email
const resetPassword = async(req : Request, res : Response): Promise<Response> => {
    let password = req.body.password;
    let id = req.query.id;
    if(config.regex.password.test(password)) {
        await collections.users.updateOne({_id : new ObjectId(String(id))}, {$set : {password : await bcrypt.hash(password, 10)}});
        return res.status(200).json({
            message : 'user successfully updated'
        });
    } else 
        return res.status(403).json({
            message : 'password did not fit the correct criteria'
        });
}

// updates the user's account with specific data that was updated, everything else will be not be updated
const updateAccount = async(id: ObjectId, user : user) => {
    const result = await getUserById(id);
    result.name = user.name;
    result.password = user.password;
    result.bio = user.bio;
    result.created = user.created;
    result.email = user.email;
    result.phone_number = user.phone_number;
    result.follow_list = user.follow_list;
    result.follower_count = user.follower_count;
    result.base_location = user.base_location;

    await collections.users.replaceOne({ _id : result._id}, result); 
}

const removeExpiredTokens = async() => {
    const results = await collections.tokens.find({}).toArray();
    const deadTokens: string[] = [];
    if(results.length == 0)
        return;
    for(let i = 0; i < results.length; i++) {
        try {
            jwt.verify(String(results[i]), config.server.token.secret);
            return;
        } catch(err) {
            deadTokens.push(String(results[i]));
        }
    }
    await collections.tokens.deleteMany(deadTokens);
    return;
}

// checks to see if the token has been used to log out. If so the user will need to relog onto the service  
const containsToken = async(token : string) => {
    const results = await collections.tokens.find({_id : token}).toArray();
    if(results.length == 0)
        return false;
    return true;
}

const getPhone = async(phone: string): Promise<user> => { 
    return await collections.users.findOne({phone_number : phone }) as user;
}

// returns all users from the database
const getAllUsers = async() => { return await collections.users.find({}).project({ password : 0, email : 0,
    phone_number : 0, 'base_location.distance' : 0, verified : 0, follow_list : 0, created : 0 }).toArray() };


// const getUsers = async(req: Request, res: Response) => {
//     return res.status(200).json(await collections.users.find().project({ _id : 1, name : 1 }).toArray() as user[])
// }

export default { /*getUsers,*/ getPhone, addUser, validateUser, getAllUsers, getEmail: checkEmail, getUserByEmail, getUserById, updateAccount, resetPassword, containsToken, checkExpiredTokens: removeExpiredTokens, addFollower, removeFollower };