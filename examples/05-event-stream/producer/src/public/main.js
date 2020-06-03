import client from "@sprig/request-client";
import { RequestEventStream } from "@sprig/request-client-events";

const form = document.getElementById("form");
form.addEventListener("submit", event => {
    const channel = document.getElementById("channel");
    const message = document.getElementById("message");
    if (channel.value && message.value) {
        const submit = document.getElementById("submit");
        const resetForm = () => {
            submit.disabled = false;
            message.value = "";
        };

        submit.disabled = true;
        client.request({ 
            url: "/api/messages", 
            method: "POST", 
            data: { 
                channel: channel.value,
                message: message.value 
            } 
        })
        .invoke()
        .then(() => resetForm())
        .catch(() => resetForm());
    }

    event.preventDefault();
});

client.request({ url: "/api/consumers", method: "GET" }).invoke().then(result => {
    setConsumers(result.data.consumers);
});

const stream = new RequestEventStream({ method: "GET", url: "/api/consumers/bind" });
stream.onMessage(event => setConsumers(event.data.consumers));

function setConsumers(values) {
    const consumers = document.getElementById("consumers");

    while (consumers.lastElementChild) {
        consumers.removeChild(consumers.lastElementChild);
    }
    
    values.forEach(value => {
        const node = document.createElement("div");
        const text = document.createTextNode(JSON.stringify(value));

        node.appendChild(text);
        consumers.appendChild(node);
    });
}