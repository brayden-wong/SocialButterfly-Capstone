export default interface query {
    tags : string[] | undefined,
    rangeDates : Date[] | undefined,
    date : Date,
    city : string,
    radius : number
}