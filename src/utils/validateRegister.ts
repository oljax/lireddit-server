import { UserPasswordInput } from "../resolvers/UserPasswordInput";

export const validateRegister = (options: UserPasswordInput) => {
    if(!options.email.includes("@")) {
        return [
                {
                    field: "email",
                    message: "invalid email",
                },
            ];
    }
    
    if(options.username.length <= 2) {
        return  [
                {
                    field: "username",
                    message: "length must be greater than 2",
                },
            ];
    }

    if(options.username.includes("@")) {
        return  [
                {
                    field: "username",
                    message: "cannot include an @ sign",
                },
            ];
    }

    if(options.password.length <= 3) {
        return [
                {
                    field: "password",
                    message: "length must be greater than 2",
                },
            ];
    }

    return null;
};