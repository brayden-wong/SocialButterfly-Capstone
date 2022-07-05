import { Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import config from '../config/config';
import user from '../interfaces/user';
import token from '../interfaces/Token';
import amqp from 'amqplib';
import jwt from 'jsonwebtoken';

const client = new MongoClient(config.mongo.url, config.mongo.options);
client.connect();

const db = client.db(config.mongo.database);
const collections = {
    users : db.collection(config.mongo.collections.MONGO_USERS),
    tokens : db.collection(String(config.mongo.collections.tokens))
};

const addUser = async(req : Request, res: Response, user: user): Promise<Response> => {
    if(!user) {
        return res.status(500).json({
            error : 'no user was sent'
        });
    } else if((await collections.users.find({ $or : [{email : user.email}, {phone_number : user.phone_number}] }).toArray()).length != 0) {
        return res.status(500).json({
            message : 'that email already exists or phone number already exists'
        });
    } else {
        await collections.users.insertOne(user);

        const sendToQueue = async(req : Request) => {
            const url = config.server.queue || 'amqp://localhost';
            const connection = await amqp.connect(url);
            const channel = await connection.createChannel();
            await channel.assertQueue('register account', {durable : true});
            let link = 'http://' + req.get('host') + '/verify?id=' + user._id.toHexString();
        
            let options = {
                from : '',
                to : user.email,
                subject : 'Social Butterfly Account Activation',
                html : 'Hello, <br> Please Click on the link to verify your account. <br><a href=' + link + '>Click here to verify your account</a>'
            };

            channel.sendToQueue('register account', Buffer.from(JSON.stringify(options)));
        };

        await sendToQueue(req);
        return res.status(200).json({
            user
        });
    }
}

const addFollower = async(id: ObjectId, token: token): Promise<void> => {
    if(await collections.users.findOne({follow_list : token.user.email}))
        console.log('found it');
    else 
        await collections.users.updateOne({_id : id,}, {$push : {follow_list : token.user.email}});
    return;
}

const validateUser = async(req : Request, res : Response): Promise<Response> => { 
    let id = new ObjectId(String(req.query.id));
    console.log(id);
    if(id === undefined) return res.status(500).json({
        error : 'the id was empty. please try again'
    });

    await collections.users.updateOne({ _id : id}, {$set : { verified : true }}); 
    return res.status(200).json({ id : id, 
        message : 'the user was authorized'});
}

const getEmail = async(email : string): Promise<boolean> => {
    if(await collections.users.findOne({email : email}))
        return true;
    return false;
}

const getUserById = async(id: string) => {
    let user = await collections.users.findOne({_id : new ObjectId(id)});
    return user;
}

const getUserByEmail = async(email : string) => {
    let user = await collections.users.findOne({email : email});
    if(user)
        return user;
    return undefined;
}

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

type account = {
    name : string,
    email : string,
    phone_number : string
}

const updateAccount = async(id : string, account : account) => { 
    await collections.users.updateOne({_id : new ObjectId(id)}, {$set : { name  : account.name, email : account.email, phone_number : account.phone_number }}); 
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

const containsToken = async(token : string) => {
    const results = await collections.tokens.find({_id : token}).toArray();
    if(results.length == 0)
        return false;
    return true;
}

const getAllUsers = async() => { return await collections.users.find({}).toArray() };

export default { addUser, validateUser, getAllUsers, getEmail, getUserByEmail, getUserById, updateAccount, resetPassword, containsToken, checkExpiredTokens: removeExpiredTokens, addFollower };