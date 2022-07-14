export default interface account {
    name : string,
    email : string,
    phone_number : string,
    bio : string | null,
    base_location : {
        city : string,
        distance : number
    }
}