export interface BookingSeat {
 id:string;sessionId:string;status:'BOOKED';alreadyBooked:boolean;
}
export interface BookingReservationPort {
 reserve(workspaceId:string,sessionId:string,userId:string):Promise<BookingSeat>;
 cancel(workspaceId:string,bookingId:string,userId:string):Promise<{id:string;status:'CANCELLED'}>;
}
