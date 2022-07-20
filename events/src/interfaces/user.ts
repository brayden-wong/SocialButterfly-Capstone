import { ObjectId } from 'mongodb';

export default interface user {
    _id : ObjectId,
    name : string,
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
    verified : boolean
};