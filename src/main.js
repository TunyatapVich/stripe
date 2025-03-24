const stripe = Stripe('pk_test_51R5je5FFnA3mGA2fdhnG5Efj28DX8UEaUntu0xXXnxLIGKOzA7B7hEDiG6CmNTRwIY370UtpLLrD6pPIKbgiakNe00BbzcjplZ')


const placeorder = async (data) => {
  const bodyData = {
    "user":{
        "name": data.name,
        "address": data.address
    },
    "product": {
        "name": "Test",
        "price": 200,
        "quantity": 1
    }
}

  const response = await axios.post("http://localhost:8000/api/checkout", bodyData)
  const sessionId = response.data.sessionId

  stripe.redirectToCheckout({
    sessionId
  });
}