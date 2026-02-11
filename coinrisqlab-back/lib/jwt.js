import jwt from "jsonwebtoken";
import Config from "../utils/config.js";
import Constants from "../utils/constants.js";

const { COINRISQLAB_API_JWT_SECRET } = Config;
const { JWT_EXPIRATION_TIME, JWT_ALGORITHM } = Constants;

/**
 * Verifies the given JWT token.
 *
 * @param {string} authJwt JWT token to verify
 * @return {boolean|object} Decoded payload of the JWT token if valid, otherwise false
 */
export function verifyJwt(authJwt) {
    try {
        return jwt.verify(authJwt, COINRISQLAB_API_JWT_SECRET);
    } catch (error) {
        return false;
    }
}

/**
 * Signs a JWT token with the given payload.
 *
 * @param {object} authPayload Payload to sign into the JWT token
 * @return {string|null} Signed JWT token if successful, otherwise null
 */
export function signJwt(authPayload) {
    try {
        return jwt.sign(authPayload, COINRISQLAB_API_JWT_SECRET, {
            algorithm: JWT_ALGORITHM,
            expiresIn: JWT_EXPIRATION_TIME,
        });
    } catch (error) {
        return null;
    }
}
