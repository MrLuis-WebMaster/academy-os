export interface SeriesBookingReceipt {
  seriesId:string;
  total:number;
  booked:number;
  alreadyBooked:number;
  inAppNotificationsCreated:number;
}
export interface SeriesBookingCancellation {
  seriesId:string;
  cancelledBookings:number;
}
export interface SeriesBookingRepository {
  reserveFuture(workspaceId:string,userId:string,seriesId:string):Promise<SeriesBookingReceipt>;
  cancelFuture(workspaceId:string,userId:string,seriesId:string):Promise<SeriesBookingCancellation>;
}
