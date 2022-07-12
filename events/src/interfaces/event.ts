import { ObjectId } from 'mongodb';

export default interface Event {
    _id : ObjectId,
    event_name : string,
    host: string,
    date : Date,
    time : string,
    tags : string[],
    formatted_address : string,
    city : string,
    location : {
        type : 'Point',
        coordinates : number[]
    },
    rsvp : 0,
    available_slots : number,
    organizations : [string] | [null],
    online : boolean
};