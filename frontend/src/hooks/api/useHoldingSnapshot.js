// src/hooks/useHoldingSnapshot.js
import {useCallback, useEffect, useState} from "react";
import useApi from "../useApi";
import {DEFAULT_PAGE_SIZE} from "../../constants/sysConst";

export default function useHoldingSnapshot(options = {}) {
    const {
        ho_id = "",
        start_date = "",
        end_date = "",
        page = 1,
        perPage = DEFAULT_PAGE_SIZE,
        autoLoad = true,
    } = options;

    const [data, setData] = useState(null);
    const {loading, error, get, post} = useApi();

    const fetch = useCallback(async () => {
        const params = new URLSearchParams({
            ho_id: ho_id || "",
            start_date: start_date || "",
            end_date: end_date || "",
            page: page.toString(),
            per_page: perPage.toString(),
        }).toString();

        try {
            const result = await get(`/holding_snapshot?${params}`);
            setData(result);
            return result;
        } catch (err) {
            throw err;
        }
    }, [get, ho_id, start_date, end_date, page, perPage]);

    useEffect(() => {
        if (autoLoad) {
            fetch();
        }
    }, [autoLoad, fetch]);

    const list_hos = useCallback(async (ho_id, start_date, end_date) => {
        const result = await post('/holding_snapshot/list_hos', {ho_id, start_date, end_date}, {});
        return result;
    }, [post]);

    return {data, loading, error, refresh: fetch, list_hos};
}
