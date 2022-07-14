import { ObjectId } from 'mongodb';

export default interface user {
    _id : ObjectId,
    name : string,
    password : string,
    email : string,
    phone_number : string,
    bio : string | null,
    base_location : {
        city : string,
        distance : number
    }
    follow_list : string[];
    created : Date,
    verified : boolean
};