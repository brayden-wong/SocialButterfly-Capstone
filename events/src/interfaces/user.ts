import { ObjectId } from 'mongodb';

export default interface user {
    _id : ObjectId,
    name : string,
    email : string,
    phone_number : string,
    follow_list : string[];
    verified : boolean
};