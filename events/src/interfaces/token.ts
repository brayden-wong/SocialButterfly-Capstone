import { ObjectId } from 'mongodb';

export default interface token {
    _id : ObjectId,
    name : string,
    email : string,
    phone_number : string
}