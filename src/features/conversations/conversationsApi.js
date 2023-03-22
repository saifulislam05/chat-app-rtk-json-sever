import { io } from "socket.io-client";
import { apiSlice } from "../api/apiSlice";
import { messagesApi } from "../messages/messagesApi";

export const conversationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query({
      query: (email) =>
        `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,
      async onCacheEntryAdded(
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        //create socket
        const socket = io("http://localhost:9000", {
          reconnectionDelay: 1000,
          reconnection: true,
          reconnectionAttempts: 10,
          transports: ["websocket"],
          agent: false,
          upgrade: false,
          rejectUnauthorized: false,
        });
        try {
          await cacheDataLoaded;
          socket.on("conversation", (data) => {
            updateCachedData((draft) => {
              const conversation = draft.find((c) => c.id == data?.data?.id);
              if (conversation?.id) {
                conversation.message = data?.data?.message;
                conversation.timestamp = data?.data?.timestamp;
              } else {
                // then push the draft conversation to the coversations list
                // const draftConversation = {
                //   id: data?.data?.id,
                //   participants: data?.data?.participants,
                //   message: data?.data?.message,
                //   timestamp: data?.data?.timestamp,
                // };
                // draft.push(draftConversation);
                // console.log(data);
              }
            });
          });
        } catch (error) {
          console.log(error);
        }
        await cacheEntryRemoved;
        socket.close();
      },
    }),
    getMoreConversations: builder.query({
      query: ({ email, page }) =>
        `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=${page}&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,
      async onQueryStarted({email}, { queryFulfilled, dispatch }) {
   
        try {
          const conversations = await queryFulfilled;
          if (conversations?.length>0) {
            // update conversation cache pesimisticallyy start
            dispatch(
              apiSlice.util.updateQueryData(
                "getConversations",
                email,
                (draft) => {
                  return[...draft,...conversations]
                }
              )
            );
            // update messages cache pesimisticallyy end
          }
        } catch (err) {
         
        }
      },
    }),
    getConversation: builder.query({
      query: ({ userEmail, participantsEmail }) =>
        `/conversations?participants_like=${userEmail}-${participantsEmail}&&participants_like=${participantsEmail}-${userEmail}`,
    }),
    addConversation: builder.mutation({
      query: ({ sender, data }) => ({
        url: `/conversations`,
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        const conversation = await queryFulfilled;
        if (conversation?.data?.id) {
          // silent entry to messag table
          const users = arg.data.users;
          const senderUser = users.find((user) => user.email === arg.sender);
          const receiverUser = users.find((user) => user.email !== arg.sender);
          dispatch(
            messagesApi.endpoints.addMessage.initiate({
              conversationId: conversation?.data?.id,
              sender: senderUser,
              receiver: receiverUser,
              message: arg.data.message,
              timestamp: arg.data.timestamp,
            })
          );
        }
      },
    }),
    editConversation: builder.mutation({
      query: ({ sender, id, data }) => ({
        url: `/conversations/${id}`,
        method: "PATCH",
        body: data,
      }),

      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        //optimistic cache updata start
        const patchResult1 = dispatch(
          apiSlice.util.updateQueryData(
            "getConversations",
            arg.sender,
            (draft) => {
              const draftConversation = draft.find((c) => c.id == arg.id);
              draftConversation.message = arg.data.message;
              draftConversation.timestamp = arg.data.timestamp;
            }
          )
        );
        //optimistic cache updata end
        try {
          const conversation = await queryFulfilled;
          if (conversation?.data?.id) {
            // silent entry to messag table
            const users = arg.data.users;
            const senderUser = users.find((user) => user.email === arg.sender);
            const receiverUser = users.find(
              (user) => user.email !== arg.sender
            );
            const res = await dispatch(
              messagesApi.endpoints.addMessage.initiate({
                conversationId: conversation?.data?.id,
                sender: senderUser,
                receiver: receiverUser,
                message: arg.data.message,
                timestamp: arg.data.timestamp,
              })
            ).unwrap();
            // update messages cache pesimisticallyy start
            dispatch(
              apiSlice.util.updateQueryData(
                "getMessages",
                res.conversationId.toString(),
                (draft) => {
                  draft.push(res);
                }
              )
            );
            // update messages cache pesimisticallyy end
          }
        } catch (err) {
          patchResult1.undo();
        }
      },
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetConversationQuery,
  useAddConversationMutation,
  useEditConversationMutation,
} = conversationsApi;
