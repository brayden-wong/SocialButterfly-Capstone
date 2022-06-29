import { Document, ObjectId } from 'mongodb';
import { response, NextFunction } from 'express'

export default interface user extends Document {
    _id : ObjectId,
    first_name : string,
    last_name : string,
    password : string,
    email : string,
    phone_number : string,
    created : Date,
    verified : boolean
};


