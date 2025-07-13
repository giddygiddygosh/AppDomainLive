import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { toast } from 'react-toastify';
import { Users, Calendar, Calculator, FileText, Download, Archive, BookText, Banknote, Clock } from 'lucide-react';
import { format } from 'date-fns';

import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect'; // Keep this if used elsewhere
import ModernMultiSelect from '../common/ModernMultiSelect'; // Correctly imported

import PayslipViewModal from './PayslipViewModal';


const PayrollPage = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [staffList, setStaffList] = useState([]); // All staff, for selection
    const [selectedStaffIds, setSelectedStaffIds] = useState([]); // Staff selected for calculation
    const [payrollSummary, setPayrollSummary] = useState(null);
    const [isLoadingStaff, setIsLoadingStaff] = useState(true);
    const [isLoadingCalculation, setIsLoadingCalculation] = useState(false);
    const [staffError, setStaffError] = useState(null);
    const [calculationError, setCalculationError] = useState(null);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [selectedPayslipId, setSelectedPayslipId] = useState(null);


    // Fetch all staff members for the selection list
    const fetchAllStaff = useCallback(async () => {
        setIsLoadingStaff(true);
        setStaffError(null);
        try {
            const res = await api.get('/staff'); // Your /api/staff endpoint
            setStaffList(res.data);
            // Optionally, pre-select all staff by default
            setSelectedStaffIds(res.data.map(s => s._id));
        } catch (err) {
            console.error('Error fetching staff for payroll:', err);
            setStaffError(err.response?.data?.message || 'Failed to load staff list.');
        } finally {
            setIsLoadingStaff(false);
        }
    }, []);

    useEffect(() => {
        fetchAllStaff();
    }, [fetchAllStaff]);

    // This handler will now directly receive the array of selected IDs from ModernMultiSelect
    const handleStaffSelectionChange = useCallback((newSelectedIds) => {
        setSelectedStaffIds(newSelectedIds);
    }, []);

    // handleSelectAllStaff is no longer needed as the multi-select component handles it internally.

    const handleCalculatePayroll = useCallback(async (e) => {
        e.preventDefault();
        setIsLoadingCalculation(true);
        setCalculationError(null);
        setPayrollSummary(null);

        if (!startDate || !endDate) {
            setCalculationError('Please select both a start date and an end date for the pay period.');
            setIsLoadingCalculation(false);
            return;
        }

        if (selectedStaffIds.length === 0) {
            setCalculationError('Please select at least one staff member to calculate payroll for.');
            setIsLoadingCalculation(false);
            return;
        }

        try {
            const res = await api.post('/payroll/calculate', {
                startDate,
                endDate,
                staffIds: selectedStaffIds,
            });
            setPayrollSummary(res.data);
            toast.success('Payroll calculated and payslips generated successfully!');
        } catch (err) {
            console.error('Error calculating payroll:', err);
            setCalculationError(err.response?.data?.message || 'Failed to calculate payroll.');
            toast.error(err.response?.data?.message || 'Failed to calculate payroll.');
        } finally {
            setIsLoadingCalculation(false);
        }
    }, [startDate, endDate, selectedStaffIds]);

    const handleViewPayslip = useCallback((payslipId) => {
        setSelectedPayslipId(payslipId);
        setIsPayslipModalOpen(true);
    }, []);

    const handleClosePayslipModal = useCallback(() => {
        setIsPayslipModalOpen(false);
        setSelectedPayslipId(null);
    }, []);

    const handleBulkDownloadPdf = useCallback(async () => {
        setIsBulkDownloading(true);
        setCalculationError(null);

        if (!startDate || !endDate) {
            setCalculationError('Please select both a start date and an end date for the pay period for bulk download.');
            setIsBulkDownloading(false);
            return;
        }
        if (selectedStaffIds.length === 0) {
            setCalculationError('Please select at least one staff member for bulk download.');
            setIsBulkDownloading(false);
            return;
        }

        try {
            const res = await api.get('/payroll/payslips/bulk-download', {
                params: {
                    startDate,
                    endDate,
                    staffIds: selectedStaffIds.join(','),
                },
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/zip' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `payslips_payroll_${format(new Date(startDate), 'yyyyMMdd')}_to_${format(new Date(endDate), 'yyyyMMdd')}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success('Selected payslips downloaded as ZIP!');
        } catch (err) {
            console.error('Error bulk downloading payslips:', err);
            setCalculationError(err.response?.data?.message || 'Failed to bulk download payslips. Please try again.');
            toast.error(err.response?.data?.message || 'Failed to bulk download payslips.');
        } finally {
            setIsBulkDownloading(false);
        }
    }, [startDate, endDate, selectedStaffIds]);

    const handleGenerateAccountantReport = useCallback(async () => {
        setIsLoadingReport(true);
        setCalculationError(null);

        if (!startDate || !endDate) {
            setCalculationError('Please select both a start date and an end date for the accountant report.');
            setIsLoadingReport(false);
            return;
        }

        try {
            const params = {
                startDate,
                endDate,
            };
            if (selectedStaffIds.length > 0) {
                params.staffIds = selectedStaffIds.join(',');
            }

            const res = await api.get('/payroll/report/summary', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `Payroll_Summary_Report_${format(new Date(startDate), 'yyyyMMdd')}_to_${format(new Date(endDate), 'yyyyMMdd')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success('Accountant Report downloaded successfully!');
        } catch (err) {
            console.error('Error generating accountant report:', err);
            let errorMessage = 'Failed to generate accountant report. Please try again.';
            if (err.response && err.response.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const errorJson = JSON.parse(reader.result);
                        errorMessage = errorJson.message || errorMessage;
                    } catch (e) {
                        // Not valid JSON
                    }
                    setCalculationError(errorMessage);
                    toast.error(errorMessage);
                };
                reader.readAsText(err.response.data);
            } else {
                setCalculationError(err.response?.data?.message || errorMessage);
                toast.error(err.response?.data?.message || errorMessage);
            }
        } finally {
            setIsLoadingReport(false);
        }
    }, [startDate, endDate, selectedStaffIds]);


    const getStatusClasses = (status) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 text-yellow-800';
            case 'Approved': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Prepare options for ModernMultiSelect
    const multiSelectStaffOptions = staffList.map(s => ({
        value: s._id,
        label: s.contactPersonName,
        subLabel: s.payRateType
    }));

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <header className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Calculator className="w-12 h-12 text-blue-600" />
                    <h1 className="text-4xl font-extrabold text-gray-900">Payroll Management</h1>
                </div>
            </header>

            {staffError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6 text-base text-center animate-fade-in">
                    {staffError}
                </div>
            )}
            {calculationError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6 text-base text-center animate-fade-in">
                    {calculationError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                {/* Select Pay Period Card */}
                <div className="md:col-span-1 bg-white p-7 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-5 flex items-center gap-3">
                        <Calendar className="text-blue-500" size={28} /> Select Pay Period
                    </h2>
                    <div className="space-y-6 w-full">
                        <ModernInput
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                        <ModernInput
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* Select Staff Card - Now uses ModernMultiSelect */}
                <div className="md:col-span-2 bg-white p-7 rounded-xl shadow-lg border border-gray-100 flex flex-col">
                    <h2 className="text-2xl font-bold text-gray-800 mb-5 flex items-center gap-3">
                        <Users className="text-green-500" size={28} /> Select Staff
                    </h2>
                    {isLoadingStaff ? (
                        <div className="text-center text-gray-500 py-8 flex flex-col items-center justify-center">
                            <Loader /> <p className="mt-3">Loading staff list...</p>
                        </div>
                    ) : staffList.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No staff members found.</p>
                    ) : (
                        // Replace the old checkbox rendering with the ModernMultiSelect component
                        <ModernMultiSelect
                            label="Select Staff Members" // This label is for the MultiSelect itself, inside its border
                            name="selectedStaff"
                            options={multiSelectStaffOptions}
                            selectedValues={selectedStaffIds}
                            onChange={handleStaffSelectionChange}
                            placeholder="Click to select staff..."
                            disabled={isLoadingStaff}
                        />
                    )}
                </div>
            </div>

            {/* Action Buttons Section */}
            <div className="text-center mb-12 flex justify-center gap-6 flex-wrap">
                <button
                    onClick={handleCalculatePayroll}
                    disabled={isLoadingCalculation || !startDate || !endDate || selectedStaffIds.length === 0}
                    className="px-10 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-xl text-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center min-w-[280px]"
                >
                    {isLoadingCalculation ? <Loader className="animate-spin mr-3" size={24} /> : <Calculator className="mr-3" size={24} />}
                    Calculate Payroll
                </button>

                {payrollSummary && payrollSummary.length > 0 && (
                    <>
                        {/* Download All Payslips Button */}
                        <button
                            onClick={handleBulkDownloadPdf}
                            disabled={isBulkDownloading || !startDate || !endDate || selectedStaffIds.length === 0}
                            className="relative px-10 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-300 shadow-xl text-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center min-w-[280px]"
                        >
                            {/* Inner flex container to control spacing of content */}
                            <span className={`flex items-center justify-center ${isBulkDownloading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
                                <Archive className="mr-3" size={24} />
                                Download All Payslips
                            </span>
                            {/* Absolute positioned loader to prevent layout shift */}
                            {isBulkDownloading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader size={24} color="white" />
                                </div>
                            )}
                        </button>

                        {/* Generate Accountant Report Button */}
                        <button
                            onClick={handleGenerateAccountantReport}
                            disabled={isLoadingReport || !startDate || !endDate}
                            className="relative px-10 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 shadow-xl text-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed transform hover:scale-105 flex items-center justify-center min-w-[280px]"
                        >
                             <span className={`flex items-center justify-center ${isLoadingReport ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
                                <BookText className="mr-3" size={24} />
                                Generate Accountant Report
                            </span>
                            {isLoadingReport && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader size={24} color="white" />
                                </div>
                            )}
                        </button>
                    </>
                )}
            </div>

            {/* Payroll Summary Section */}
            {payrollSummary && payrollSummary.length > 0 && (
                <div className="mt-8 bg-white p-7 rounded-xl shadow-lg border border-blue-100 animate-fade-in">
                    <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-3">
                        <FileText className="text-blue-600" size={28} /> Payroll Summary ({format(new Date(startDate), 'MMM dd, yyyy')} - {format(new Date(endDate), 'MMM dd, yyyy')})
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-blue-200">
                            <thead className="bg-blue-50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider">Staff Name</th>
                                    <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider">Pay Type</th>
                                    <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider">Details</th>
                                    <th scope="col" className="px-6 py-4 text-right text-sm font-semibold text-blue-700 uppercase tracking-wider">Gross Pay</th>
                                    <th scope="col" className="px-6 py-4 text-center text-sm font-semibold text-blue-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-blue-100">
                                {payrollSummary.map(entry => (
                                    <tr
                                        key={entry.payslipId}
                                        className="hover:bg-blue-50 transition-colors duration-150 ease-in-out"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900 flex items-center gap-2">
                                            <Users size={18} className="text-gray-400" />
                                            {entry.staffName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-700">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                entry.payRateType === 'Hourly' ? 'bg-indigo-100 text-indigo-800' :
                                                entry.payRateType === 'Fixed per Job' ? 'bg-orange-100 text-orange-800' :
                                                entry.payRateType === 'Percentage per Job' ? 'bg-pink-100 text-pink-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {entry.payRateType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            {entry.payRateType === 'Hourly' && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={16} className="text-gray-500" />
                                                    {`Hours: ${entry.payDetails.totalHours} @ £${entry.payDetails.rate}`}
                                                </span>
                                            )}
                                            {entry.payRateType === 'Fixed per Job' && (
                                                <span className="flex items-center gap-1">
                                                    <BookText size={16} className="text-gray-500" />
                                                    {`Jobs: ${entry.payDetails.totalJobs} @ £${entry.payDetails.amountPerJob}`}
                                                </span>
                                            )}
                                            {entry.payRateType === 'Percentage per Job' && (
                                                <span className="flex items-center gap-1">
                                                    <Banknote size={16} className="text-gray-500" />
                                                    {`Value: £${entry.payDetails.totalJobValue} (${entry.payDetails.percentage}%)`}
                                                </span>
                                            )}
                                            {entry.payRateType === 'Daily Rate' && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={16} className="text-gray-500" />
                                                    {`Days: ${entry.payDetails.totalDays} @ £${entry.payDetails.ratePerDay}`}
                                                </span>
                                            )}
                                            {entry.payDetails.message && <span className="text-gray-500 block text-xs mt-1">({entry.payDetails.message})</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-lg font-bold text-green-700">£{entry.grossPay.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            {entry.payslipId ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleViewPayslip(entry.payslipId); }}
                                                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
                                                    title="View Payslip"
                                                >
                                                    <FileText className="mr-1 h-4 w-4" /> View
                                                </button>
                                            ) : (
                                                <span className="px-3 py-1 text-sm font-medium text-gray-500">Not Generated</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {payrollSummary && payrollSummary.length === 0 && (
                <div className="mt-8 bg-yellow-50 p-6 rounded-lg shadow-lg border border-yellow-200 text-center text-yellow-800 animate-fade-in">
                    No payroll entries found for the selected criteria.
                </div>
            )}

            {isPayslipModalOpen && (
                <PayslipViewModal
                    isOpen={isPayslipModalOpen}
                    onClose={handleClosePayslipModal}
                    payslipId={selectedPayslipId}
                />
            )}
        </div>
    );
};

export default PayrollPage;