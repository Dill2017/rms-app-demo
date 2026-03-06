import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface CalendarDaySummary {
    avg_price: number;
    avg_suggested_price: number;
    booking_status: string;
    date: string;
    event_name?: string | null;
    occupancy_pct: number;
    pickup_rooms: number;
    rooms_left: number;
    rooms_sold: number;
    total_rooms: number;
}
export interface CompetitorPriceRow {
    competitor_name: string;
    diff_pct: number;
    price: number;
    room_type: string;
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface DashboardKPIs {
    adr: number;
    avg_occupancy_pct: number;
    avg_website_conversion: number;
    occupancy_change_pct: number;
    revenue_change_pct: number;
    revpar: number;
    total_bookings_mtd: number;
    total_revenue_mtd: number;
}
export interface DemandForecastRow {
    confidence: number;
    demand_level: string;
    demand_score: number;
    expected_booking_attempts: number;
    expected_bookings: number;
    expected_searches: number;
    forecast_date: string;
    lead_time_days: number;
    model_version: string;
}
export interface GenieAskIn {
    conversation_id?: string | null;
    question: string;
}
export interface GenieAskOut {
    conversation_id: string;
    error?: string | null;
    message_id: string;
    query_result?: GenieQueryResult | null;
    sql?: string | null;
    status: string;
    suggested_questions?: string[] | null;
    text?: string | null;
}
export interface GenieQueryResult {
    columns: string[];
    data: (string | number | number | null)[][];
    row_count: number;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface HotelDetail {
    adr: number;
    city: string;
    country: string;
    hotel_id: string;
    name: string;
    occupancy_pct: number;
    region: string;
    revenue_mtd: number;
    revpar: number;
    room_types: RoomTypeInfo[];
    star_rating: number;
    total_rooms: number;
}
export interface HotelListOut {
    hotels: HotelSummary[];
    page: number;
    page_size: number;
    total: number;
}
export interface HotelSummary {
    adr: number;
    city: string;
    country: string;
    hotel_id: string;
    name: string;
    occupancy_pct: number;
    region: string;
    revpar: number;
    star_rating: number;
    total_rooms: number;
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface OccupancyByRegion {
    avg_occupancy: number;
    hotel_count: number;
    region: string;
    total_rooms: number;
}
export interface OccupancyForecastRow {
    confidence: number;
    forecast_date: string;
    lead_time_days: number;
    lower_bound_pct: number;
    model_version: string;
    predicted_occupancy_pct: number;
    predicted_rooms_sold: number;
    room_type: string;
    total_rooms: number;
    upper_bound_pct: number;
}
export interface OccupancyRow {
    date: string;
    occupancy_pct: number;
    room_type: string;
    rooms_sold: number;
    total_rooms: number;
}
export interface OpportunityRow {
    avg_competitor_price: number;
    avg_current_price: number;
    avg_suggested_price: number;
    city: string;
    confidence: number;
    current_revpar: number;
    displacement_risk: string;
    hotel_id: string;
    hotel_name: string;
    occupancy_pct: number;
    price_vs_competitor_pct: number;
    region: string;
    revpar_uplift: number;
    revpar_uplift_pct: number;
    star_rating: number;
    suggested_revpar: number;
    top_room_type: string;
    top_room_uplift: number;
}
export interface PickupCurvePoint {
    lead_time_days: number;
    occupancy_pct: number;
}
export interface PricingDecisionIn {
    accepted_price: number;
    date: string;
    decision: string;
    expected_revpar: number;
    room_type: string;
    suggested_price: number;
}
export interface PricingDecisionOut {
    date: string;
    decision: string;
    expected_revpar: number;
    hotel_id: string;
    new_price: number;
    old_price: number;
    room_type: string;
    success: boolean;
}
export interface RevenueTrendPoint {
    date: string;
    revenue: number;
    rooms_sold: number;
}
export interface RoomDateDetail {
    adjustment_pct: number;
    base_price: number;
    competitor_avg: number;
    current_price: number;
    demand_score: number;
    expected_occupancy: number;
    expected_revpar: number;
    market_factor_pct: number;
    occupancy_factor_pct: number;
    occupancy_pct: number;
    price_7_days_ago?: number | null;
    price_source: string;
    price_vs_competitor_pct: number;
    price_yesterday?: number | null;
    room_count: number;
    room_type: string;
    rooms_left: number;
    rooms_sold: number;
    suggested_price: number;
    suggestion_confidence: number;
}
export interface RoomPricingRow {
    base_price: number;
    competitor_avg: number;
    current_price: number;
    date: string;
    demand_score: number;
    expected_occupancy: number;
    expected_revpar: number;
    forecast_confidence?: number | null;
    forecast_demand_level?: string | null;
    forecast_demand_score?: number | null;
    forecast_occupancy_lower?: number | null;
    forecast_occupancy_pct?: number | null;
    forecast_occupancy_upper?: number | null;
    occupancy_pct: number;
    price_source: string;
    price_vs_competitor_pct: number;
    room_type: string;
    suggested_price: number;
    suggestion_confidence: number;
}
export interface RoomTypeInfo {
    base_price: number;
    max_occupancy: number;
    name: string;
    room_count: number;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface WebTrafficRow {
    booking_attempts: number;
    bookings_completed: number;
    conversion_rate: number;
    date: string;
    page_views: number;
    searches: number;
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export interface GetDashboardKpisParams {
    region?: string;
}
export const getDashboardKpis = async (params?: GetDashboardKpisParams, options?: RequestInit): Promise<{
    data: DashboardKPIs;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.region != null) searchParams.set("region", String(params?.region));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/dashboard/kpis?${queryString}` : "/api/dashboard/kpis";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getDashboardKpisKey = (params?: GetDashboardKpisParams)=>{
    return [
        "/api/dashboard/kpis",
        params
    ] as const;
};
export function useGetDashboardKpis<TData = {
    data: DashboardKPIs;
}>(options?: {
    params?: GetDashboardKpisParams;
    query?: Omit<UseQueryOptions<{
        data: DashboardKPIs;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getDashboardKpisKey(options?.params),
        queryFn: ()=>getDashboardKpis(options?.params),
        ...options?.query
    });
}
export function useGetDashboardKpisSuspense<TData = {
    data: DashboardKPIs;
}>(options?: {
    params?: GetDashboardKpisParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: DashboardKPIs;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getDashboardKpisKey(options?.params),
        queryFn: ()=>getDashboardKpis(options?.params),
        ...options?.query
    });
}
export const getOccupancyByRegion = async (options?: RequestInit): Promise<{
    data: OccupancyByRegion[];
}> =>{
    const res = await fetch("/api/dashboard/occupancy-by-region", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getOccupancyByRegionKey = ()=>{
    return [
        "/api/dashboard/occupancy-by-region"
    ] as const;
};
export function useGetOccupancyByRegion<TData = {
    data: OccupancyByRegion[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: OccupancyByRegion[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getOccupancyByRegionKey(),
        queryFn: ()=>getOccupancyByRegion(),
        ...options?.query
    });
}
export function useGetOccupancyByRegionSuspense<TData = {
    data: OccupancyByRegion[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: OccupancyByRegion[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getOccupancyByRegionKey(),
        queryFn: ()=>getOccupancyByRegion(),
        ...options?.query
    });
}
export interface GetPickupCurveParams {
    region?: string;
    hotel_id?: string;
    target_date?: string;
}
export const getPickupCurve = async (params?: GetPickupCurveParams, options?: RequestInit): Promise<{
    data: PickupCurvePoint[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.region != null) searchParams.set("region", String(params?.region));
    if (params?.hotel_id != null) searchParams.set("hotel_id", String(params?.hotel_id));
    if (params?.target_date != null) searchParams.set("target_date", String(params?.target_date));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/dashboard/pickup-curve?${queryString}` : "/api/dashboard/pickup-curve";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getPickupCurveKey = (params?: GetPickupCurveParams)=>{
    return [
        "/api/dashboard/pickup-curve",
        params
    ] as const;
};
export function useGetPickupCurve<TData = {
    data: PickupCurvePoint[];
}>(options?: {
    params?: GetPickupCurveParams;
    query?: Omit<UseQueryOptions<{
        data: PickupCurvePoint[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getPickupCurveKey(options?.params),
        queryFn: ()=>getPickupCurve(options?.params),
        ...options?.query
    });
}
export function useGetPickupCurveSuspense<TData = {
    data: PickupCurvePoint[];
}>(options?: {
    params?: GetPickupCurveParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: PickupCurvePoint[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getPickupCurveKey(options?.params),
        queryFn: ()=>getPickupCurve(options?.params),
        ...options?.query
    });
}
export interface GetRevenueTrendParams {
    days?: number;
    region?: string;
}
export const getRevenueTrend = async (params?: GetRevenueTrendParams, options?: RequestInit): Promise<{
    data: RevenueTrendPoint[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.days != null) searchParams.set("days", String(params?.days));
    if (params?.region != null) searchParams.set("region", String(params?.region));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/dashboard/revenue-trend?${queryString}` : "/api/dashboard/revenue-trend";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getRevenueTrendKey = (params?: GetRevenueTrendParams)=>{
    return [
        "/api/dashboard/revenue-trend",
        params
    ] as const;
};
export function useGetRevenueTrend<TData = {
    data: RevenueTrendPoint[];
}>(options?: {
    params?: GetRevenueTrendParams;
    query?: Omit<UseQueryOptions<{
        data: RevenueTrendPoint[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getRevenueTrendKey(options?.params),
        queryFn: ()=>getRevenueTrend(options?.params),
        ...options?.query
    });
}
export function useGetRevenueTrendSuspense<TData = {
    data: RevenueTrendPoint[];
}>(options?: {
    params?: GetRevenueTrendParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: RevenueTrendPoint[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getRevenueTrendKey(options?.params),
        queryFn: ()=>getRevenueTrend(options?.params),
        ...options?.query
    });
}
export const debugDbInfo = async (options?: RequestInit): Promise<{
    data: Record<string, unknown>;
}> =>{
    const res = await fetch("/api/debug/db-info", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const debugDbInfoKey = ()=>{
    return [
        "/api/debug/db-info"
    ] as const;
};
export function useDebugDbInfo<TData = {
    data: Record<string, unknown>;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: Record<string, unknown>;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: debugDbInfoKey(),
        queryFn: ()=>debugDbInfo(),
        ...options?.query
    });
}
export function useDebugDbInfoSuspense<TData = {
    data: Record<string, unknown>;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: Record<string, unknown>;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: debugDbInfoKey(),
        queryFn: ()=>debugDbInfo(),
        ...options?.query
    });
}
export const askGenie = async (data: GenieAskIn, options?: RequestInit): Promise<{
    data: GenieAskOut;
}> =>{
    const res = await fetch("/api/genie/ask", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useAskGenie(options?: {
    mutation?: UseMutationOptions<{
        data: GenieAskOut;
    }, ApiError, GenieAskIn>;
}) {
    return useMutation({
        mutationFn: (data)=>askGenie(data),
        ...options?.mutation
    });
}
export interface ListHotelsParams {
    search?: string;
    region?: string;
    page?: number;
    page_size?: number;
}
export const listHotels = async (params?: ListHotelsParams, options?: RequestInit): Promise<{
    data: HotelListOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.search != null) searchParams.set("search", String(params?.search));
    if (params?.region != null) searchParams.set("region", String(params?.region));
    if (params?.page != null) searchParams.set("page", String(params?.page));
    if (params?.page_size != null) searchParams.set("page_size", String(params?.page_size));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels?${queryString}` : "/api/hotels";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listHotelsKey = (params?: ListHotelsParams)=>{
    return [
        "/api/hotels",
        params
    ] as const;
};
export function useListHotels<TData = {
    data: HotelListOut;
}>(options?: {
    params?: ListHotelsParams;
    query?: Omit<UseQueryOptions<{
        data: HotelListOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listHotelsKey(options?.params),
        queryFn: ()=>listHotels(options?.params),
        ...options?.query
    });
}
export function useListHotelsSuspense<TData = {
    data: HotelListOut;
}>(options?: {
    params?: ListHotelsParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: HotelListOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listHotelsKey(options?.params),
        queryFn: ()=>listHotels(options?.params),
        ...options?.query
    });
}
export interface GetHotelParams {
    hotel_id: string;
}
export const getHotel = async (params: GetHotelParams, options?: RequestInit): Promise<{
    data: HotelDetail;
}> =>{
    const res = await fetch(`/api/hotels/${params.hotel_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelKey = (params?: GetHotelParams)=>{
    return [
        "/api/hotels/{hotel_id}",
        params
    ] as const;
};
export function useGetHotel<TData = {
    data: HotelDetail;
}>(options: {
    params: GetHotelParams;
    query?: Omit<UseQueryOptions<{
        data: HotelDetail;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelKey(options.params),
        queryFn: ()=>getHotel(options.params),
        ...options?.query
    });
}
export function useGetHotelSuspense<TData = {
    data: HotelDetail;
}>(options: {
    params: GetHotelParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: HotelDetail;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelKey(options.params),
        queryFn: ()=>getHotel(options.params),
        ...options?.query
    });
}
export interface GetHotelCalendarParams {
    hotel_id: string;
    month?: string | null;
}
export const getHotelCalendar = async (params: GetHotelCalendarParams, options?: RequestInit): Promise<{
    data: CalendarDaySummary[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.month != null) searchParams.set("month", String(params?.month));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/calendar?${queryString}` : `/api/hotels/${params.hotel_id}/calendar`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelCalendarKey = (params?: GetHotelCalendarParams)=>{
    return [
        "/api/hotels/{hotel_id}/calendar",
        params
    ] as const;
};
export function useGetHotelCalendar<TData = {
    data: CalendarDaySummary[];
}>(options: {
    params: GetHotelCalendarParams;
    query?: Omit<UseQueryOptions<{
        data: CalendarDaySummary[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelCalendarKey(options.params),
        queryFn: ()=>getHotelCalendar(options.params),
        ...options?.query
    });
}
export function useGetHotelCalendarSuspense<TData = {
    data: CalendarDaySummary[];
}>(options: {
    params: GetHotelCalendarParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: CalendarDaySummary[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelCalendarKey(options.params),
        queryFn: ()=>getHotelCalendar(options.params),
        ...options?.query
    });
}
export interface GetHotelCompetitorsParams {
    hotel_id: string;
    target_date?: string | null;
}
export const getHotelCompetitors = async (params: GetHotelCompetitorsParams, options?: RequestInit): Promise<{
    data: CompetitorPriceRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.target_date != null) searchParams.set("target_date", String(params?.target_date));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/competitors?${queryString}` : `/api/hotels/${params.hotel_id}/competitors`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelCompetitorsKey = (params?: GetHotelCompetitorsParams)=>{
    return [
        "/api/hotels/{hotel_id}/competitors",
        params
    ] as const;
};
export function useGetHotelCompetitors<TData = {
    data: CompetitorPriceRow[];
}>(options: {
    params: GetHotelCompetitorsParams;
    query?: Omit<UseQueryOptions<{
        data: CompetitorPriceRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelCompetitorsKey(options.params),
        queryFn: ()=>getHotelCompetitors(options.params),
        ...options?.query
    });
}
export function useGetHotelCompetitorsSuspense<TData = {
    data: CompetitorPriceRow[];
}>(options: {
    params: GetHotelCompetitorsParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: CompetitorPriceRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelCompetitorsKey(options.params),
        queryFn: ()=>getHotelCompetitors(options.params),
        ...options?.query
    });
}
export interface GetHotelDemandForecastParams {
    hotel_id: string;
    start_date?: string | null;
    end_date?: string | null;
}
export const getHotelDemandForecast = async (params: GetHotelDemandForecastParams, options?: RequestInit): Promise<{
    data: DemandForecastRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.start_date != null) searchParams.set("start_date", String(params?.start_date));
    if (params?.end_date != null) searchParams.set("end_date", String(params?.end_date));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/demand-forecast?${queryString}` : `/api/hotels/${params.hotel_id}/demand-forecast`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelDemandForecastKey = (params?: GetHotelDemandForecastParams)=>{
    return [
        "/api/hotels/{hotel_id}/demand-forecast",
        params
    ] as const;
};
export function useGetHotelDemandForecast<TData = {
    data: DemandForecastRow[];
}>(options: {
    params: GetHotelDemandForecastParams;
    query?: Omit<UseQueryOptions<{
        data: DemandForecastRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelDemandForecastKey(options.params),
        queryFn: ()=>getHotelDemandForecast(options.params),
        ...options?.query
    });
}
export function useGetHotelDemandForecastSuspense<TData = {
    data: DemandForecastRow[];
}>(options: {
    params: GetHotelDemandForecastParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: DemandForecastRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelDemandForecastKey(options.params),
        queryFn: ()=>getHotelDemandForecast(options.params),
        ...options?.query
    });
}
export interface GetHotelOccupancyParams {
    hotel_id: string;
    start_date?: string | null;
    end_date?: string | null;
}
export const getHotelOccupancy = async (params: GetHotelOccupancyParams, options?: RequestInit): Promise<{
    data: OccupancyRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.start_date != null) searchParams.set("start_date", String(params?.start_date));
    if (params?.end_date != null) searchParams.set("end_date", String(params?.end_date));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/occupancy?${queryString}` : `/api/hotels/${params.hotel_id}/occupancy`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelOccupancyKey = (params?: GetHotelOccupancyParams)=>{
    return [
        "/api/hotels/{hotel_id}/occupancy",
        params
    ] as const;
};
export function useGetHotelOccupancy<TData = {
    data: OccupancyRow[];
}>(options: {
    params: GetHotelOccupancyParams;
    query?: Omit<UseQueryOptions<{
        data: OccupancyRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelOccupancyKey(options.params),
        queryFn: ()=>getHotelOccupancy(options.params),
        ...options?.query
    });
}
export function useGetHotelOccupancySuspense<TData = {
    data: OccupancyRow[];
}>(options: {
    params: GetHotelOccupancyParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: OccupancyRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelOccupancyKey(options.params),
        queryFn: ()=>getHotelOccupancy(options.params),
        ...options?.query
    });
}
export interface GetHotelOccupancyForecastParams {
    hotel_id: string;
    start_date?: string | null;
    end_date?: string | null;
    room_type?: string | null;
}
export const getHotelOccupancyForecast = async (params: GetHotelOccupancyForecastParams, options?: RequestInit): Promise<{
    data: OccupancyForecastRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.start_date != null) searchParams.set("start_date", String(params?.start_date));
    if (params?.end_date != null) searchParams.set("end_date", String(params?.end_date));
    if (params?.room_type != null) searchParams.set("room_type", String(params?.room_type));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/occupancy-forecast?${queryString}` : `/api/hotels/${params.hotel_id}/occupancy-forecast`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelOccupancyForecastKey = (params?: GetHotelOccupancyForecastParams)=>{
    return [
        "/api/hotels/{hotel_id}/occupancy-forecast",
        params
    ] as const;
};
export function useGetHotelOccupancyForecast<TData = {
    data: OccupancyForecastRow[];
}>(options: {
    params: GetHotelOccupancyForecastParams;
    query?: Omit<UseQueryOptions<{
        data: OccupancyForecastRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelOccupancyForecastKey(options.params),
        queryFn: ()=>getHotelOccupancyForecast(options.params),
        ...options?.query
    });
}
export function useGetHotelOccupancyForecastSuspense<TData = {
    data: OccupancyForecastRow[];
}>(options: {
    params: GetHotelOccupancyForecastParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: OccupancyForecastRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelOccupancyForecastKey(options.params),
        queryFn: ()=>getHotelOccupancyForecast(options.params),
        ...options?.query
    });
}
export interface GetHotelPricingParams {
    hotel_id: string;
    start_date?: string | null;
    end_date?: string | null;
    room_type?: string | null;
}
export const getHotelPricing = async (params: GetHotelPricingParams, options?: RequestInit): Promise<{
    data: RoomPricingRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.start_date != null) searchParams.set("start_date", String(params?.start_date));
    if (params?.end_date != null) searchParams.set("end_date", String(params?.end_date));
    if (params?.room_type != null) searchParams.set("room_type", String(params?.room_type));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/pricing?${queryString}` : `/api/hotels/${params.hotel_id}/pricing`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelPricingKey = (params?: GetHotelPricingParams)=>{
    return [
        "/api/hotels/{hotel_id}/pricing",
        params
    ] as const;
};
export function useGetHotelPricing<TData = {
    data: RoomPricingRow[];
}>(options: {
    params: GetHotelPricingParams;
    query?: Omit<UseQueryOptions<{
        data: RoomPricingRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelPricingKey(options.params),
        queryFn: ()=>getHotelPricing(options.params),
        ...options?.query
    });
}
export function useGetHotelPricingSuspense<TData = {
    data: RoomPricingRow[];
}>(options: {
    params: GetHotelPricingParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: RoomPricingRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelPricingKey(options.params),
        queryFn: ()=>getHotelPricing(options.params),
        ...options?.query
    });
}
export interface UpdateHotelPricingParams {
    hotel_id: string;
}
export const updateHotelPricing = async (params: UpdateHotelPricingParams, data: PricingDecisionIn, options?: RequestInit): Promise<{
    data: PricingDecisionOut;
}> =>{
    const res = await fetch(`/api/hotels/${params.hotel_id}/pricing`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useUpdateHotelPricing(options?: {
    mutation?: UseMutationOptions<{
        data: PricingDecisionOut;
    }, ApiError, {
        params: UpdateHotelPricingParams;
        data: PricingDecisionIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>updateHotelPricing(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface GetRoomDateDetailParams {
    hotel_id: string;
    target_date: string;
}
export const getRoomDateDetail = async (params: GetRoomDateDetailParams, options?: RequestInit): Promise<{
    data: RoomDateDetail[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params.target_date != null) searchParams.set("target_date", String(params.target_date));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/room-date-detail?${queryString}` : `/api/hotels/${params.hotel_id}/room-date-detail`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getRoomDateDetailKey = (params?: GetRoomDateDetailParams)=>{
    return [
        "/api/hotels/{hotel_id}/room-date-detail",
        params
    ] as const;
};
export function useGetRoomDateDetail<TData = {
    data: RoomDateDetail[];
}>(options: {
    params: GetRoomDateDetailParams;
    query?: Omit<UseQueryOptions<{
        data: RoomDateDetail[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getRoomDateDetailKey(options.params),
        queryFn: ()=>getRoomDateDetail(options.params),
        ...options?.query
    });
}
export function useGetRoomDateDetailSuspense<TData = {
    data: RoomDateDetail[];
}>(options: {
    params: GetRoomDateDetailParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: RoomDateDetail[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getRoomDateDetailKey(options.params),
        queryFn: ()=>getRoomDateDetail(options.params),
        ...options?.query
    });
}
export interface GetHotelWebTrafficParams {
    hotel_id: string;
    start_date?: string | null;
    end_date?: string | null;
}
export const getHotelWebTraffic = async (params: GetHotelWebTrafficParams, options?: RequestInit): Promise<{
    data: WebTrafficRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.start_date != null) searchParams.set("start_date", String(params?.start_date));
    if (params?.end_date != null) searchParams.set("end_date", String(params?.end_date));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/hotels/${params.hotel_id}/web-traffic?${queryString}` : `/api/hotels/${params.hotel_id}/web-traffic`;
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getHotelWebTrafficKey = (params?: GetHotelWebTrafficParams)=>{
    return [
        "/api/hotels/{hotel_id}/web-traffic",
        params
    ] as const;
};
export function useGetHotelWebTraffic<TData = {
    data: WebTrafficRow[];
}>(options: {
    params: GetHotelWebTrafficParams;
    query?: Omit<UseQueryOptions<{
        data: WebTrafficRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getHotelWebTrafficKey(options.params),
        queryFn: ()=>getHotelWebTraffic(options.params),
        ...options?.query
    });
}
export function useGetHotelWebTrafficSuspense<TData = {
    data: WebTrafficRow[];
}>(options: {
    params: GetHotelWebTrafficParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: WebTrafficRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getHotelWebTrafficKey(options.params),
        queryFn: ()=>getHotelWebTraffic(options.params),
        ...options?.query
    });
}
export interface GetOpportunitiesParams {
    region?: string;
    limit?: number;
}
export const getOpportunities = async (params?: GetOpportunitiesParams, options?: RequestInit): Promise<{
    data: OpportunityRow[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.region != null) searchParams.set("region", String(params?.region));
    if (params?.limit != null) searchParams.set("limit", String(params?.limit));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/opportunities?${queryString}` : "/api/opportunities";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getOpportunitiesKey = (params?: GetOpportunitiesParams)=>{
    return [
        "/api/opportunities",
        params
    ] as const;
};
export function useGetOpportunities<TData = {
    data: OpportunityRow[];
}>(options?: {
    params?: GetOpportunitiesParams;
    query?: Omit<UseQueryOptions<{
        data: OpportunityRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getOpportunitiesKey(options?.params),
        queryFn: ()=>getOpportunities(options?.params),
        ...options?.query
    });
}
export function useGetOpportunitiesSuspense<TData = {
    data: OpportunityRow[];
}>(options?: {
    params?: GetOpportunitiesParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: OpportunityRow[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getOpportunitiesKey(options?.params),
        queryFn: ()=>getOpportunities(options?.params),
        ...options?.query
    });
}
export const listRegions = async (options?: RequestInit): Promise<{
    data: string[];
}> =>{
    const res = await fetch("/api/regions", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listRegionsKey = ()=>{
    return [
        "/api/regions"
    ] as const;
};
export function useListRegions<TData = {
    data: string[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: string[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listRegionsKey(),
        queryFn: ()=>listRegions(),
        ...options?.query
    });
}
export function useListRegionsSuspense<TData = {
    data: string[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: string[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listRegionsKey(),
        queryFn: ()=>listRegions(),
        ...options?.query
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
