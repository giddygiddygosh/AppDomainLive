import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import InvoiceTable from './InvoiceTable';
import Loader from '../common/Loader'; // Your Loader component
import { toast } from 'react-toastify';

const InvoicePage = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInvoices = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/invoices');
            setInvoices(res.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch invoices. Please try again later.');
            console.error(err);
            toast.error("Failed to fetch invoices.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    // RENDER THE LOADER AS THE ENTIRE PAGE IF LOADING
    if (loading) {
        return <Loader />; // This will render your full-page loader
    }

    // Render error message if there is one and not loading
    if (error) {
        return (
            <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
                <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>
            </div>
        );
    }

    // Render content only when not loading and no error
    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
            </header>

            <main>
                <div className="bg-white rounded-lg shadow-md">
                    <InvoiceTable invoices={invoices} />
                </div>
            </main>
        </div>
    );
};

export default InvoicePage;