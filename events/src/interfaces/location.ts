import { ObjectId } from 'mongodb';

export default interface location {
    _id : ObjectId,
    location : {
        type : 'Point',
        city : string,
        coordinates : number[]
    }
}