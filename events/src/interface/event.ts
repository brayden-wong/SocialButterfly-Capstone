import { ObjectId } from 'mongodb';

export default interface Event {
    _id : ObjectId,
    event_name : string,
    date : Date,
    tags : [string],
    formatted_address : string,
    city : string,
    location : {
        type : string,
        coordinates : number[]
    },
    rsvp : 0,
    available_slots : number,
    organizations : [string] | [null],
    online : boolean
};