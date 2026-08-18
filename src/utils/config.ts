export const CONFIG = {
    API: 'api',
    API_VERSION: '1',
    BAD_REQUEST: 'Bad request',
    UNAUTH_REQUEST: 'Unauthorized',
    NOT_FOUND: 'Not found',
    CREATE_FAILED: 'Create failed',
    UPDATE_FAILED: 'Update failed',
    DELETE_FAILED: 'Delete failed',
    GENERIC_ERROR: 'An error occurred',
    DUPLICATE_FOUND: 'Duplicate data found',
    JWT_SECRET: 'com.domain',
    HTTP_200: 200, // Ok
    HTTP_201: 201, // Created
    HTTP_400: 400, // Bad request
    HTTP_401: 401, // Unauthorized
    HTTP_403: 403, // Forbidden
    HTTP_404: 404, // Not found
    HTTP_500: 500, // Internal server error
} as const;