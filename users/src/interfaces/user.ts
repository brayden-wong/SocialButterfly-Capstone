import { ObjectId } from 'mongodb';

export default interface user {
    _id : ObjectId,
    name : string,
    password : string,
    email : string,
    phone_number : string,
    base_location : string,
    follow_list : string[];
    created : Date,
    verified : boolean
};