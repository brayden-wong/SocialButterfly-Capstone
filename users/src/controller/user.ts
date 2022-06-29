import { Request, Response, NextFunction, response, request } from 'express';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import database from '../database/user';
import user from '../interface/user'
import config from '../config/config';
import amqp from 'amqplib';


const regex = {
    email : /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
    phone : /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    password : /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,16}$/
}

const verifyAccount = (req : Request, res : Response, next : NextFunction) => {
    
    return res.status(400).json({
        message : 'authorized'
    });
};

const register = async(req : Request, res : Response, next : NextFunction): Promise<Response> => {
    let {
        first_name,
        last_name,
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
        first_name : first_name,
        last_name : last_name,
        password : req.body.password,
        email : email,
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
        if(regex.email.test(email) && regex.password.test(password) && regex.phone.test(phone_number)) {
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


export default {verifyAccount, register, login, getAllUsers};