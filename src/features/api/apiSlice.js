import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({
        baseUrl: process.env.REACT_APP_API_URL,
        prepareHeaders: async (Headers, { getState, endpoints })=>{
            const token = getState()?.auth?.accessToken;
            if (token) {
                Headers.set("Authorization", `Bearer ${token}`);
            }
            return Headers
        }
    }),
    tagTypes: [],
    endpoints: (builder)=>({}),

})