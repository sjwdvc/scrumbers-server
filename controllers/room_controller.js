
/**
 * @param {Request} req
 * @param {Response} res
 */
const create = (req, res) => {
    console.log(req.body);
    res.status(200).json();
}

module.exports = {
    create
}