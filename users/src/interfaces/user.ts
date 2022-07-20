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
        coords : number[],
        distance : number
    }
    follow_list : string[];
    follower_count : number,
    created : Date,
    verified : boolean
};