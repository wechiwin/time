import dayjs from "dayjs";

export function now() {
    return dayjs().format('YYYY-MM-DD HH:mm:ss')
}