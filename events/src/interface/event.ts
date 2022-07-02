import { ObjectId } from 'mongodb';

export default interface Event {
    _id : ObjectId,
    event_name : string,
    date : Date | null,
    tags : [string],
    formatted_address : string,
    city : string,
    location : Object,
    rsvp : number,
    available_slots : number,
    organizations : [string] | [null],
    online : boolean
};