import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { format, subMonths } from 'date-fns';

// Import Chart.js and specific components for react-chartjs-2
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Register the necessary Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const FinancialDashboardPage = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [financialData, setFinancialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for filter options (for future enhancements like staff/customer/stock filters)
    const [filterOptions, setFilterOptions] = useState({
        staff: [], // e.g., list of all staff to populate dropdown
        customers: [], // e.g., list of all customers
        stockItems: [], // e.g., list of all stock items
    });

    // Calculate default dates for the filter: Last 12 months (or up to today)
    const today = new Date();
    const defaultEndDate = format(today, 'yyyy-MM-dd');
    const dateTwelveMonthsAgo = subMonths(today, 11);
    const defaultStartDate = format(dateTwelveMonthsAgo, 'yyyy-MM-dd');

    // State for selected date range and future filters
    const [selectedStartDate, setSelectedStartDate] = useState(defaultStartDate);
    const [selectedEndDate, setSelectedEndDate] = useState(defaultEndDate);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedStockId, setSelectedStockId] = useState('');


    useEffect(() => {
        const fetchFinancialData = async () => {
            if (!user || !localStorage.getItem('token')) {
                setError("Authentication token is missing. Please log in again.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null); // Clear previous errors
                
                const config = {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    params: {
                        startDate: selectedStartDate,
                        endDate: selectedEndDate,
                        staffId: selectedStaffId,     // Pass selected staff ID to backend
                        customerId: selectedCustomerId, // Pass selected customer ID to backend
                        stockId: selectedStockId,     // Pass selected stock ID to backend
                    }
                };
                
                const { data } = await api.get('/dashboard/financials', config);
                
                setFinancialData(data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching financial data:", err.response?.data?.message || err.message);
                if (err.response && err.response.status === 401) {
                    setError("Not authorized. Please log in again to view financial data.");
                } else if (err.response && err.response.status === 403) {
                    setError("You do not have permission to view this data.");
                } else {
                    // Check if error message contains "startOfMonth is not defined" or "Use `yyyy`"
                    // These are likely from backend, provide a generic message or try to parse specific ones if needed
                    const backendErrorMsg = err.response?.data?.message || err.message;
                    if (backendErrorMsg.includes("startOfMonth is not defined") || backendErrorMsg.includes("Use `yyyy` instead of `YYYY`")) {
                         setError("Backend data processing error. Please check server logs for details.");
                    } else {
                         setError(t('financialDashboardPage.errorFetchingData') + ": " + backendErrorMsg);
                    }
                }
                setLoading(false);
            }
        };

        // Future: Fetch filter options (staff, customers, stock) once on component mount
        const fetchFilterOptions = async () => {
            try {
                // You'd need separate backend endpoints for these, e.g.:
                // const { data: staffData } = await api.get('/staff/list-for-filters');
                // const { data: customerData } = await api.get('/customers/list-for-filters');
                // const { data: stockData } = await api.get('/stock/list-for-filters');
                // setFilterOptions({ staff: staffData, customers: customerData, stockItems: stockData });
            } catch (err) {
                console.error("Error fetching filter options:", err);
            }
        };

        if (user) {
            fetchFinancialData();
            fetchFilterOptions(); // Call once on mount
        }
    }, [user, selectedStartDate, selectedEndDate, selectedStaffId, selectedCustomerId, selectedStockId, t]); // Re-fetch when user or any filter changes

    // Prepare chart data when financialData is available
    const chartLabels = financialData?.revenueByMonth?.map(item => item.month) || [];
    const revenueDataset = financialData?.revenueByMonth?.map(item => item.revenue) || [];
    const profitDataset = financialData?.revenueByMonth?.map(item => item.profit) || [];

    const revenueChartData = {
        labels: chartLabels,
        datasets: [
            {
                label: t('financialDashboardPage.monthlyRevenue'),
                data: revenueDataset,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.3,
                fill: false,
            },
        ],
    };

    const profitChartData = {
        labels: chartLabels,
        datasets: [
            {
                label: t('financialDashboardPage.monthlyProfit'),
                data: profitDataset,
                borderColor: 'rgb(53, 162, 235)',
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
                tension: 0.3,
                fill: false,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false, // Allows chart to fill parent div better
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: false, // Title handled by h3 above the chart
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: t('financialDashboardPage.month'),
                },
            },
            y: {
                title: {
                    display: true,
                    text: t('financialDashboardPage.amount'),
                },
                beginAtZero: true,
            },
        },
    };

    // Placeholder for other chart data (e.g., staff performance, customer performance)
    // These would require separate aggregations in the backend as well.
    const staffPerformanceChartData = { /* ... */ };
    const customerPerformanceChartData = { /* ... */ };
    const stockUsageChartData = { /* ... */ };


    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <p className="text-gray-600">{t('financialDashboardPage.loadingData')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-red-500">
                <p>{t('financialDashboardPage.errorFetchingData')}: {error}</p>
            </div>
        );
    }
    
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('financialDashboardPage.title')}</h1>
            <p className="text-gray-700 mb-8">{t('financialDashboardPage.welcomeMessage')}</p>

            {/* Date Range & Breakdown Filters */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('financialDashboardPage.filterData')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    {/* Date Filters */}
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">{t('financialDashboardPage.startDate')}</label>
                        <input
                            type="date"
                            id="startDate"
                            value={selectedStartDate}
                            onChange={(e) => setSelectedStartDate(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">{t('financialDashboardPage.endDate')}</label>
                        <input
                            type="date"
                            id="endDate"
                            value={selectedEndDate}
                            onChange={(e) => setSelectedEndDate(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                    {/* Staff Filter (Example - requires filterOptions.staff from backend) */}
                    <div>
                        <label htmlFor="staffFilter" className="block text-sm font-medium text-gray-700">{t('financialDashboardPage.filterByStaff')}</label>
                        <select
                            id="staffFilter"
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            <option value="">{t('financialDashboardPage.allStaff')}</option>
                            {/* Map staff from filterOptions.staff */}
                            {filterOptions.staff.map(staff => (
                                <option key={staff._id} value={staff._id}>{staff.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* Customer Filter (Example - requires filterOptions.customers from backend) */}
                    <div>
                        <label htmlFor="customerFilter" className="block text-sm font-medium text-gray-700">{t('financialDashboardPage.filterByCustomer')}</label>
                        <select
                            id="customerFilter"
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            <option value="">{t('financialDashboardPage.allCustomers')}</option>
                            {/* Map customers from filterOptions.customers */}
                            {filterOptions.customers.map(customer => (
                                <option key={customer._id} value={customer._id}>{customer.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* Add more filters here (e.g., Stock Category, Job Type) */}
                </div>
            </div>

            {/* Section 1: The Command Center (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">{t('financialDashboardPage.totalRevenueSelectedPeriod')}</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">£{financialData.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">{t('financialDashboardPage.costOfGoodsSold')}</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">£{financialData.totalCOGS.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">{t('financialDashboardPage.grossProfit')}</p>
                    <p className="mt-1 text-3xl font-semibold text-green-600">£{financialData.grossProfit.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">{t('financialDashboardPage.profitMargin')}</p>
                    <p className="mt-1 text-3xl font-semibold text-blue-600">{financialData.profitMargin.toFixed(2)}%</p>
                </div>
            </div>

            {/* Section for Outstanding/Overdue Invoices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">{t('financialDashboardPage.totalOutstandingInvoices')}</p>
                    <p className="mt-1 text-3xl font-semibold text-yellow-600">£{financialData.outstandingBalance.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <p className="text-sm font-medium text-gray-500">{t('financialDashboardPage.totalOverdueAmount')}</p>
                    <p className="mt-1 text-3xl font-semibold text-red-600">£{financialData.overdueBalance.toFixed(2)}</p>
                </div>
            </div>

            {/* Section 2: Profitability Over Time (Charts) */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('financialDashboardPage.profitabilityOverTime')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-96"> {/* Increased height for charts */}
                    {chartLabels.length > 0 ? (
                        <>
                            <div className="bg-gray-50 p-4 rounded-md flex flex-col justify-center items-center">
                                <h3 className="text-lg font-semibold mb-2">{t('financialDashboardPage.monthlyRevenue')}</h3>
                                <div className="w-full h-full flex items-center justify-center">
                                    <Line options={{...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t('financialDashboardPage.monthlyRevenue')}}}} data={revenueChartData} />
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-md flex flex-col justify-center items-center">
                                <h3 className="text-lg font-semibold mb-2">{t('financialDashboardPage.monthlyProfit')}</h3>
                                <div className="w-full h-full flex items-center justify-center">
                                    <Line options={{...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t('financialDashboardPage.monthlyProfit')}}}} data={profitChartData} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="col-span-2 flex justify-center items-center h-full text-gray-500">
                            <p>{t('financialDashboardPage.noChartData')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Section 3: The Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Staff Performance */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('financialDashboardPage.staffPerformanceRevenue')}</h2>
                    {financialData.staffPerformance && financialData.staffPerformance.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {financialData.staffPerformance.map((staff) => (
                                <li key={staff.staffId} className="py-3 flex justify-between items-center">
                                    <span className="text-gray-700 font-medium">{staff.staffName || t('financialDashboardPage.unknownStaff')}</span>
                                    <span className="text-gray-900 font-semibold">£{staff.totalRevenue.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">{t('financialDashboardPage.noStaffPerformanceData')}</p>
                    )}
                </div>

                {/* Customer Performance */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('financialDashboardPage.topCustomersRevenue')}</h2>
                    {financialData.customerPerformance && financialData.customerPerformance.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {financialData.customerPerformance.map((customer) => (
                                <li key={customer.customerId} className="py-3 flex justify-between items-center">
                                    <span className="text-gray-700 font-medium">{customer.customerName || t('financialDashboardPage.unknownCustomer')}</span>
                                    <span className="text-gray-900 font-semibold">£{customer.totalRevenue.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">{t('financialDashboardPage.noCustomerRevenueData')}</p>
                    )}
                </div>
            </div>

            {/* Stock Usage Cost */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('financialDashboardPage.stockUsageCost')}</h2>
                {financialData.stockUsageCosts && financialData.stockUsageCosts.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {financialData.stockUsageCosts.map((stock) => (
                            <li key={stock.stockId} className="py-3 flex justify-between items-center">
                                <span className="text-gray-700 font-medium">{stock.stockName || t('financialDashboardPage.unknownStock')} ({t('financialDashboardPage.stockUsed', { quantity: stock.quantityUsed })})</span>
                                <span className="text-gray-900 font-semibold">£{stock.totalCost.toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">{t('financialDashboardPage.noStockUsageData')}</p>
                )}
            </div>

            {/* Section 4: The QuickBooks Funnel & Reporting */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{t('financialDashboardPage.quickbooksIntegration')}</h2>
                <div className="text-center">
                    <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                        {t('financialDashboardPage.quickbooksPitch')}
                    </p>
                    <div className="mt-6 space-y-4">
                        <p className="text-lg font-medium text-red-500">{t('financialDashboardPage.quickbooksStatusNotConnected')}</p>
                        <a
                            href="/api/quickbooks/connect" 
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            {t('financialDashboardPage.connectToQuickbooks')}
                        </a>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-gray-600 font-medium">{t('financialDashboardPage.unlockWithQuickbooks')}</p>
                            <div className="flex flex-wrap justify-center gap-4 mt-2">
                                {/* These buttons would trigger backend report generation/downloads */}
                                <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-400 cursor-not-allowed flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M5 9V7a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5a2 2 0 012-2zm2-2h6v2H7V7zm6 3H7v5h6v-5z" clipRule="evenodd" /> </svg> {t('financialDashboardPage.viewFullPnlReport')}
                                </button>
                                <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-400 cursor-not-allowed flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 1H4v10h12V5zm-1 3H5V7h10v1zm-3 4H5v-1h7v1z" clipRule="evenodd" /> </svg> {t('financialDashboardPage.runTaxSummary')}
                                </button>
                                <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-400 cursor-not-allowed flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M10 3a1 1 0 011 1v4a1 1 0 102 0V4a3 3 0 00-3-3H6a3 3 0 00-3 3v12a3 3 0 003 3h4a1 1 0 100-2H6a1 1 0 01-1-1V4a1 1 0 011-1h4z" clipRule="evenodd" /> </svg> {t('financialDashboardPage.exportToAccountant')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialDashboardPage;