const validate = value => {

    // Initialise return value
    let response
    let harms =
        [
            "<script>",
            "alert",
            "console",
            "{",
            "}",
            "!",
            "<",
            ">"
        ]

    // If value is empty
    response = (value === '') ? 'empty' : 200

    // If value contains any of the harmfull characters defined above
    harms.forEach(harm => value.includes(harm) ? response = 'chars' : 200)

    return response;
}

module.exports = validate;