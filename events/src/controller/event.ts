import { Response, Request } from 'express';
import { ObjectId } from 'mongodb';
import Event from '../interfaces/event';
import axios from 'axios';
import Location from '../interfaces/location';
import config from '../config/config';
import database from '../database/event';
import range from '../interfaces/range';
import query from '../interfaces/query';
import user from '../interfaces/user';
import verify from '../middleware/verify';
import eureka from '../eureka-helper';
import { Eureka } from 'eureka-js-client';
let client: Eureka;

setTimeout(() => {
    client = eureka.registerService('event-api', Number.parseInt(config.server.port));
}, 30000);

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

const getMeters = (miles: number) => {
    return miles * 1609.344;
}

const getMonth = async(date: Date) => {
    const month = date.getMonth() + 1;

    const isLeapYear = (year: number) => {
        return year % 100 === 0 ? year % 400 === 0 : year % 4 === 0;
    }

    const query = (month: number): range => {
        switch(month) {
            case 1: 
                return { '$gte' : new Date('01-01-' + date.getFullYear()), '$lte' : new Date('02-01-' + date.getFullYear())};
            case 2:
                if(isLeapYear(date.getFullYear())) {
                    return { '$gte' : new Date('02-01-' + date.getFullYear()), '$lte' : new Date('03-01-' + date.getFullYear())};
                } else {
                    return { '$gte' : new Date('02-01-' + date.getFullYear()), '$lte' : new Date('03-01-' + date.getFullYear())};
                } 
            case 3:
                return { '$gte' : new Date('03-01-' + date.getFullYear()), '$lte' : new Date('04-01-' + date.getFullYear())};
            case 4:
                return { '$gte' : new Date('04-01-' + date.getFullYear()), '$lte' : new Date('05-01-' + date.getFullYear())};
            case 5:
                return { '$gte' : new Date('05-01-' + date.getFullYear()), '$lte' : new Date('06-01-' + date.getFullYear())};
            case 6:
                return { '$gte' : new Date('06-01-' + date.getFullYear()), '$lte' : new Date('07-01-' + date.getFullYear())};
            case 7:
                return { '$gte' : new Date('07-01-' + date.getFullYear()), '$lte' : new Date('08-01-' + date.getFullYear())};
            case 8:
                return { '$gte' : new Date('08-01-' + date.getFullYear()), '$lte' : new Date('09-01-' + date.getFullYear())};
            case 9:
                return { '$gte' : new Date('09-01-' + date.getFullYear()), '$lte' : new Date('10-01-' + date.getFullYear())};
            case 10:
                return { '$gte' : new Date('10-01-' + date.getFullYear()), '$lte' : new Date('11-01-' + date.getFullYear())};
            case 11:
                return { '$gte' : new Date('11-01-' + date.getFullYear()), '$lte' : new Date('12-01-' + date.getFullYear())};
            case 12:   
                return { '$gte' : new Date('12-01-' + date.getFullYear()), '$lte' : new Date('01-01-' + date.getFullYear() + 1)};
            default:
                return {'$gte' : null, '$lte' : null }
        }
    }
    return await database.eventsThisMonth(query(month));
}

const validateEvent = async(event: Event): Promise<Boolean> => {
    const results = await getMonth(event.date);

    if(await database.doTagsMatch(event))
            return false;
    else {
        if(results.length > 0) {
            for(let i = 0; i < results.length; i++) {
                let count = 0;
                for(let j = 0; j < results[i].tags.length; j++) {
                    for(let k = 0; k < event.tags.length; k++) {
                        if(results[i].tags[j] === event.tags[k])
                            count++;
                    }
                }
                if(count < 3) 
                    return true;
                count = 0;
            }
        }
        return true;
    }
    
};

const updateAddress = async(event: Event): Promise<Event> => {
    await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
            address : event.formatted_address,
            key : config.server.google_api_key
        }
    })
        .then(async response => {
            const city = response.data.results[0].address_components.filter((address: { types: string | string[]; }) => address.types.includes('locality'))[0].long_name;
            event.city = city;

            event.location.coordinates.push(response.data.results[0].geometry.location.lng);
            event.location.coordinates.push(response.data.results[0].geometry.location.lat);

            return event;
        });
    return event;
}

const uploadCity = async(event: Event) => {
    await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
            address : event.city,
            key : config.server.google_api_key
        }
    })
        .then(async response => {
            const location: Location = {
                _id : new ObjectId(),
                location : {
                    type: 'Point',
                    city : response.data.results[0].address_components.filter((address : { types : string | string[];}) => address.types.includes('locality'))[0].long_name,
                    coordinates : [
                        response.data.results[0].geometry.location.lng,
                        response.data.results[0].geometry.location.lat
                    ]
                }
            };
            await database.insertCity(location);
        });
};

const getUser = async(req: Request): Promise<user> => {
    const id = verify.getToken(req);
    const response = await axios.get(`http://users:3000/getUser?id=${id}`);
    const user:user = {
        _id : response.data.user._id,
        name : response.data.user.name,
        email : response.data.user.email,
        phone_number : response.data.user.phone_number,
        bio : response.data.bio,
        base_location : {
            city : response.data.user.base_location.city,
            coords : response.data.user.base_location.coords,
            distance : response.data.user.base_location.distance
        },
        follow_list : response.data.user.follow_list,
        follower_count : response.data.user.follower_count,
        verified : response.data.user.verified
    };
    return user;
}

const setDateTime = (date: Date, time: string): Date => {
    const index = time.indexOf(":"); // replace with ":" for differently displayed time.
    const index2 = time.indexOf(" ");

    let hours = Number.parseInt(time.substring(0, index));
    const minutes = Number.parseInt(time.substring(index + 1, index2));

    var mer = time.substring(index2 + 1, time.length);
    if (mer == 'PM' || mer == 'pm')
        hours += 12;

    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0o0);
    
    return date;
}

const registerEvent = async(req : Request, res : Response): Promise<Response> => {
    const user = await getUser(req);
    if(!user.verified)
        return res.status(500).json('user is not verified');
    const date = setDateTime(new Date(req.body.date), String(req.body.time));
    
    const isMorning = String(req.body.time).substring(String(req.body.time).indexOf(' ') + 1, String(req.body.time).length);

    const tags: string[] = [];

    for(let i = 0; i < req.body.tags.length; i++) {
        tags.push(String(req.body.tags[i]).toLowerCase());
    }

    let event: Event = {
        _id : new ObjectId(),
        event_name : req.body.event_name,
        host : {
            id : user._id.toString(),
            name : user.name
        },
        date : new Date(String(req.body.date)),
        time : date.getHours() + ':' + (date.getMinutes() === 0 ? '00' : date.getMinutes()) + ' ' + isMorning,
        tags : tags,
        formatted_address : req.body.address,
        location : {
            type : 'Point',
            coordinates : []
        },
        city : req.body.city,
        rsvp : [],
        available_slots : req.body.available_slots,
        organizations : req.body.organizations,
        online : req.body.online
    };
    
    const checkParameters = (event : Event) => {
        Object.values(event).every(value => {
            if(value === undefined) return true;
        });
        return false;
    }

    if(checkParameters(event))
        return res.status(401).json('one or many fields are undefined');

    if(await database.checkLocation(event.city)) {
        /*
            After this if statement you need to check to see if there are similar 
            events like this happening in the area
        */
        event = await updateAddress(event);
        if(await validateEvent(event)) {
            await database.insertEvent(event);
            return res.status(200).json({
                message : '😄 event successfully added',
                event
            });
        } else {
            return res.status(500).json('this event has too many events');
        }
    } else {

        await updateAddress(event);

        await database.insertEvent(event);

        if(!await database.checkLocation(event.city))
            await uploadCity(event);

        return res.status(200).json({
            message : '😄 event successfully added',
            event
        });
    }
}

const getEvents = async(req: Request, res: Response)/*: Promise<Response>*/ => {
    const temp = new Date();
    const parameters: query = {
        tags : req.body.tags === undefined ? [] : req.body.tags,
        dates : req.body.dates === undefined ? [new Date(temp.getFullYear(), temp.getMonth(), temp.getDate())] : req.body.dates.length === 2 ? req.body.dates : [new Date(req.body.dates)], //req.body.dates.length === 2 ? req.body.dates : req.body.dates,
        city : String(req.body.city),
        radius : req.body.radius === undefined ? 50 : Number.parseInt(req.body.radius)
    }; 

    const city = await database.cityLocation(parameters.city);

    if(city !== null) {
        const query = [{
            $geoNear : {
                near : { type : 'Point', coordinates : [city.location.coordinates[0], city.location.coordinates[1]]},
                query : { $and : [
                    parameters.tags.length === 0 ? { tags : { $exists : true, $not : { $size : 0 }}} : {tags : { $in : parameters.tags }},
                    parameters.dates.length === 2 ? { $and : [
                        { date : { $gte : new Date(parameters.dates[0])}},
                        { date : { $lte : new Date(parameters.dates[1])}}
                    ]} : { $and : [
                        { date : { $gte : parameters.dates[0]}},
                        { date : { $lt : new Date(parameters.dates[0].getFullYear(), parameters.dates[0].getMonth(), parameters.dates[0].getDate() + 1)}}
                    ]},
                    { city : new RegExp(parameters.city, 'i')},
                    
                    
                ]},
                maxDistance : getMeters(parameters.radius),
                distanceField : 'dist.calculated',
                spherical : true
            }
        }];

        // const query = [{ 
        //     $match : {
        //         $and : [
        //             parameters.tags.length === 0 ? { tags : { $exists : true, $not : { $size : 0 }}} : { tags : { $in : parameters.tags }},
        //             parameters.dates.length === 2 ? { $and : [
        //                 { date : { $gte : new Date(parameters.dates[0])}},
        //                 { date : { $lte : new Date(parameters.dates[1])}}
        //             ]} : { $and : [
        //                 { date : { $gte : parameters.dates[0]}},
        //                 { date : { $lt : new Date(parameters.dates[0].getFullYear(), parameters.dates[0].getMonth(), parameters.dates[0].getDate() + 1)}}
        //             ]},
        //             { city : new RegExp(parameters.city, 'i')}
        //         ]
        //     }
        // }];
        return res.status(200).json(await database.getEvents(query));
    }
}

const nearMe = async(req: Request, res: Response) => {
    const user = await getUser(req);

    if(user.base_location.city !== null)
        return res.status(200).json(await database.nearMe(user));
    return res.status(200).json(user.base_location.city);
    
}

const searchByTags = async(req: Request, res: Response): Promise<Response> => {
    const distances: {[key: number]: number } = {
        10 : 16093.4,
        25 : 40233.6,
        50 : 80467.2
    };

    if(req.body.tags !== undefined && req.body.city !== undefined && req.body.distance !== undefined) {
        const city = String(req.body.city);
        const filters = req.body.tags;
        const getRadius = (distance: number): number => {
            for(const [k, v] of Object.entries(distances)) 
                if(k === distance.toString())
                    return v
            return -1;
        };

        const radius = getRadius(Number.parseInt(req.body.distance));;
        if(radius === -1)
            return res.status(404).json('invalid radius');
        
        if(filters.length > 5 || filters.length === 0)
            return res.status(500).json({
                message : 'too many filters or you don\'t have any filters'
            });
        
        return await database.searchByTags(res, city, radius, filters);
    } else 
        return res.status(500).json('no filters were sent in the body');
}

const rsvp = async(req: Request, res: Response): Promise<Response> => {
    const user = await getUser(req);
    const id = new ObjectId(String(req.query.id));
    if(user.verified)
        return await database.rsvp(res, id, user);
    return res.status(500).json('you have to be a verified user to rsvp to events');
}

const checkLocation = async(req: Request, res: Response): Promise<Response> => {
    const city = String(req.body.city);

    const exists = await database.checkLocation(city);

    if(exists !== null)
        if(exists)
            return res.status(200).json(true);
        else {
            await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: {
                    address : city,
                    key : config.server.google_api_key
                }
            })
            .then(async response => {
                const location: Location = {
                    _id : new ObjectId(),
                    location : {
                        type: 'Point',
                        city : response.data.results[0].address_components.filter((address : { types : string | string[];}) => address.types.includes('locality'))[0].long_name,
                        coordinates : [
                            response.data.results[0].geometry.location.lng,
                            response.data.results[0].geometry.location.lat
                        ]
                    }
                };
                await database.insertCity(location);
                return res.status(200).json(false);
            });
        }
    return res.status(500);
}

const validateLocation = async(req: Request, res: Response): Promise<Response> => {

    let user = req.body.user as user;

    user = await database.validateLocation(user);

    return res.status(200).json(user);
}

const massImport = async(req: Request, res: Response) => {
    
    const response = await axios.get('http://users:3000/users');
    const locations = await database.getLocations(); 
    
    const users:user[] = response.data;

    type name = {
        name : string
    };

    const csvFilePath = path.resolve(__dirname, 'files/MOCK_DATA.csv');
    const headers = ['name'];
    const fileContent = fs.readFileSync(csvFilePath, { encoding : 'utf-8' });

    parse(fileContent, {
        delimiter : ',',
        columns: headers,
        fromLine : 2
    }, async(error, result: name[]) => {
        if(error)
            console.log(error);
        else {
            let times = ["7:00 am", "7:15 am", "7:30 am", "7:45 am", "8:00 am", "8:15 am", "8:30 am", "8:45 am", "9:00 am", "9:15 am", "9:30 am", "9:45 am","10:00 am", 
            "10:15 am", "10:30 am", "10:45 am", "11:00 am", "11:15 am", "11:30 am", "11:45 am", "12:00 pm", "12:15 pm", "12:30 pm", "12:45 pm", "1:00 pm", "1:15 pm", "1:30 pm",
            "1:45 pm", "2:00 pm", "2:15 pm", "2:30 pm", "2:45 pm", "3:00 pm", "3:15 pm", "3:30 pm", "3:45 pm", "4:00 pm", "4:15 pm", "4:30 pm", "4:45 pm", "5:00 pm", "5:15 pm",
            "5:30 pm", "5:45 pm", "6:00 pm", "6:15 pm", "6:30 pm", "6:45 pm", "7:00 pm","7:15 pm","7:30 pm", "7:45 pm", "8:00 pm", "8:15 pm", "8:30 pm", "8:45 pm", "9:00 pm", 
            "9:15 pm", "9:30 pm", "9:45 pm", "10:00 pm", "10:15 pm", "10:30 pm", "10:45 pm", "11:00 pm"];

            let taglist = ["basketball", "sports", "soccer", "dragonboat", "python", "javascript", "java", "hack-a-thon", "running", "star-gazing", "swimming", "league of legends",
            "mongodb", "mysql", "sqlserver", "nodejs", "springboot", "movies", "tv-shows", "foodie", "convention", "apex legends", "music", "concert", "free", "rave", "edm", "gaming",
            "football", "sneakers", "mechanical keyboards", "cooking", "meet and greet", "cook out", "kpop", "jpop", "cpop", "anime", "festival", "parade", "fair", "park", "nature", "carnival",
            "hiking", "outdoors", "dogs", "cats", "pets", "coding", "bird watching", "whale watching", "boba", "bubble tea", "culinary arts", "ruby", "php", "ruby on rails", "flask", "wine tasting",
            "night market", "vegan", "vegetarian", "meat lovers", "fasion", "hats", "protests", "march", "music festival", "fitness", "track and field", "youtube", "twtich", "computers", "beer tasting",
            "art", "drawing", "painting", "art show", "comedy", "areospace", "software engineering", "biology", "chemistry", "physics", "engineering", "marine biology", "math", "algebra", "tutoring", 
            "career fair", "technology", "product management", "information systems", "parenting", "traveling", "date night", "arts and crafts", "movie night", "frank n son"
            ];

            const randomDate = (start: Date, end: Date) => {
                return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
            }

            const events: Event[] = [];

            for(let i = 0; i < 50; i++) {
                const eventValue = Math.floor(Math.random() * result.length);
                const nameValue = Math.floor(Math.random() * users.length);
                const user = users[nameValue];
                const timeValue = Math.floor(Math.random() * times.length);
                const time = times[timeValue];
                const num_of_tags = Math.floor(Math.random() * 5) + 1;
                const tags: string[] = [];
                const date = randomDate(new Date(2022, 0, 1), new Date(2024, 11, 31));
                for(let k = 0; k < num_of_tags; k++) {
                    let value = Math.floor(Math.random() * taglist.length);
                    if(tags.includes(taglist[value]))
                        while(tags.includes(taglist[value])) {
                            value = Math.floor(Math.random() * taglist.length);
                            tags.push(taglist[value]);
                        }
                    else    
                        tags.push(taglist[value]);
                }
                const cityValue = Math.floor(Math.random() * locations.length);
                const location = locations[cityValue].location;
                let positive = Math.floor(Math.random() * 2) + 1 === 1 ? true : false;
                const alterLong = (Math.random() * (.1 - 0.0001));
                if(positive)
                    location.coordinates[0] += alterLong;
                else 
                    location.coordinates[0] -= alterLong;
                positive = Math.floor(Math.random() * 2) + 1 === 1 ? true : false;
                const alterLat = (Math.random() * (.1 - 0.0001) + .1);
                if(positive)
                    location.coordinates[1] += alterLat;
                else 
                    location.coordinates[1] -= alterLat;
                const response = await axios.request({
                    method : 'get',
                    url : 'https://maps.googleapis.com/maps/api/geocode/json',
                    params : {
                        key : config.server.google_api_key,
                        latlng : `${location.coordinates[1]},${location.coordinates[0]}`
                    }
                });
                // if(response.data.results[0].address_components.filter((address: { types: string | string[]; }) => address.types.includes('locality'))[0].long_name)
                //     city = response.data.results[0].address_components.filter((address: { types: string | string[]; }) => address.types.includes('locality'))[0].long_name;
                // else
                const city = response.data.results[0].address_components[2].long_name;
                const formatted_address = response.data.results[0].formatted_address;
                const number = Math.floor(Math.random() * 100) + 50;
                const available_slots = number <= 60 ? -1 : Math.floor(Math.random() * 100) + 50;

                const event: Event = {
                    _id : new ObjectId(),
                    event_name : result[eventValue].name,
                    host : {
                        id : user._id.toString(),
                        name : user.name,
                    },
                    date,
                    time,
                    tags,
                    formatted_address,
                    location : {
                        type : 'Point',
                        coordinates: location.coordinates
                    },
                    city,
                    rsvp : [],
                    available_slots,
                    organizations: [],
                    online : positive
                }
                console.log(event);
                events.push(event);
                if(events.length === 5) {
                    database.insertManyEvents(events);
                    events.splice(0, events.length);
                }
            }
        }
    });

    res.status(200).json('done');
}

export default { /*massImport,*/ registerEvent, getEvents, searchByTags, rsvp, nearMe, checkLocation, validateLocation }