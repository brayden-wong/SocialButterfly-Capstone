import { ObjectId } from 'mongodb';

export default interface Event {
    _id : ObjectId,
    event_name : string,
    date : Date,
    tags : [string],
    formatted_address : string,
    location : Object,
    rsvp : number,
    available_slots : number,
    organizations : [string],
    online : boolean
};