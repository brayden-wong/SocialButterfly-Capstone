import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import config from '../config/config';
import jwt from 'jsonwebtoken';
import token from '../interfaces/token';


const verify = async(req: Request, res: Response, next: NextFunction) => {
    let token = String(req.headers['authorization']).split(' ')[1];
    if(token === undefined) return res.status(401).json('you are not logged in');

    let user = jwt.verify(token, String(config.server.secret));

    user = user as token;
    next();
};

const getToken = (req: Request): ObjectId => {
    const token = String(req.headers['authorization']).split(' ')[1];
    let user = jwt.verify(token, String(config.server.secret));
    user = user as token;

    let authorized: token = {
        id : user.id,
    };

    return authorized.id;
}

export default { verify, getToken };