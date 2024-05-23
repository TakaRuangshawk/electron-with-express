function sendMessage(message) {
    var messageInput = message;
    console.log(messageInput);
    fetch('http://127.0.0.1:3000/sendMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageInput })
    })
        .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
        .then(data => {
        console.log('Message sent:', data);
    })
        .catch(error => {
        console.error('Error sending message:', error);
    });
}
