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

    // If input values contain any of the harmful characters defined above
    Object.values(value).forEach(input => {
        harms.forEach(harm => input.includes(harm) ? response = 'chars' : 200)
    })

    return response;
}

module.exports = validate;