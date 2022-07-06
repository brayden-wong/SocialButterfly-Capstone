import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import database from '../database/user';
import token from '../interfaces/Token';

const verify = async(req: Request, res: Response, next: NextFunction) => {
    let token = String(req.headers['authorization']).split(' ')[1];
    if(token === undefined) return res.status(401).json('you are not logged in');

    if(!await database.containsToken(token)) {
        let user = jwt.verify(token, config.server.token.secret);

        user = user as token;
        next();
    }
};

const getToken = (req: Request): token => {
    const token = String(req.headers['authorization']).split(' ')[1];
    let user = jwt.verify(token, config.server.token.secret);
    user = user as token;

    let authorized: token = {
        user : {
            id : user.id,
            email : user.email,
            verified : user.verified
        }
    }

    return authorized;
}

export default { verify, getToken };