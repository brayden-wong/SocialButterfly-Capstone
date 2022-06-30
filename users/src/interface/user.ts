import { Document, ObjectId } from 'mongodb';
import { response, NextFunction } from 'express'

export default interface user extends Document {
    _id : ObjectId,
    name : string,
    password : string,
    email : string,
    phone_number : string,
    created : Date,
    verified : boolean
};


