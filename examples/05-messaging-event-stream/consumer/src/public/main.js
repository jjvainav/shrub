import { RequestEventStream } from "@sprig/request-client-events";

const form = document.getElementById("form");
form.addEventListener("submit", event => {
    const channel = document.getElementById("channel");
    const subscription = document.getElementById("subscription");

    if (channel.value && subscription.value) {
        const url = `/api/messages/bind?channel=${encodeURIComponent(channel.value)}&subscriptionId=${encodeURIComponent(subscription.value)}`
        const stream = new RequestEventStream({ method: "GET", url });
        const connect = document.getElementById("connect");
        const disconnect = document.getElementById("disconnect");
        const resetForm = () => {
            disconnect.disabled = true;
            connect.disabled = false;
        };

        connect.disabled = true;
        disconnect.disabled = false;
        disconnect.onclick = () => stream.close();

        stream.onMessage(event => appendMessage(event.data));
        stream.onClose(() => resetForm());
        stream.onError(event => {
            resetForm();
            alert(event.message);
        });
    }

    event.preventDefault();
});

function appendMessage(value) {
    const messages = document.getElementById("messages");
    const node = document.createElement("div");
    const text = document.createTextNode(JSON.stringify(value));

    node.appendChild(text);
    messages.appendChild(node);
}