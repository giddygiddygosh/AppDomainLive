// src/views/LeadsView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader'; // Keep this import if Loader is used elsewhere in LeadsView (e.g., initial page load)
import ConfirmationModal from '../common/ConfirmationModal';
import AddContactModal from '../common/AddContactModal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { toast } from 'react-toastify';
import { useMapsApi } from '../../App';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LeadsView = () => {
    const { isMapsLoaded, isMapsLoadError } = useMapsApi();
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [selectedLeadForAction, setSelectedLeadForAction] = useState(null);
    const [selectedLeadIds, setSelectedLeadIds] = useState([]);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [actionToConfirm, setActionToConfirm] = useState(null);
    const [leadToDelete, setLeadToDelete] = useState(null);
    const [editingLeadStatusId, setEditingLeadStatusId] = useState(null); // State to track which lead's status is being edited

    const [pagination, setPagination] = useState({
        totalCount: 0,
        currentPage: 1,
        totalPages: 1,
    });

    const [reFetchTrigger, setReFetchTrigger] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterSource, setFilterSource] = useState(
        location.pathname === '/quotes' ? 'Website Quote Form' : ''
    );
    const [filterStatus, setFilterStatus] = useState(
        location.pathname === '/quotes' ? 'New Quote Request' : ''
    );
    const [currentPageFilter, setCurrentPageFilter] = useState(1);
    const [leadsPerPage] = useState(10);

    const leadStatusOptions = [
        { value: '', label: 'All Statuses' },
        { value: 'New', label: 'New' },
        { value: 'New Quote Request', label: 'New Quote Request' },
        { value: 'Contacted', label: 'Contacted' },
        { value: 'Qualified', label: 'Qualified' },
        { value: 'Unqualified', label: 'Unqualified' },
        { value: 'Converted', label: 'Converted' },
    ];

    const leadSourceOptions = [
        { value: '', label: 'All Sources' },
        { value: 'Website', label: 'Website' },
        { value: 'Referral', label: 'Referral' },
        { value: 'Social Media', label: 'Social Media' },
        { value: 'Cold Call', label: 'Cold Call' },
        { value: 'Website Quote Form', label: 'Website Quote Form' },
        { value: 'Other', label: 'Other' },
    ];

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page: currentPageFilter,
                limit: leadsPerPage,
                ...(searchTerm && { search: searchTerm }),
                ...(filterSource && { source: filterSource }),
                ...(filterStatus && { status: filterStatus }),
            };
            
            const res = await api.get('/leads', { params });
            setLeads(res.data.leads || []);
            
            setPagination({
                totalCount: res.data.totalCount || 0,
                currentPage: res.data.currentPage || 1,
                totalPages: res.data.totalPages || 1,
            });

            setSelectedLeadIds([]);
        } catch (err) {
            console.error('Error fetching leads:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'Failed to fetch leads.');
        } finally {
            setLoading(false);
        }
    }, [currentPageFilter, leadsPerPage, searchTerm, filterSource, filterStatus]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads, reFetchTrigger]);

    useEffect(() => {
        if (location.pathname === '/quotes') {
            setFilterSource('Website Quote Form');
            setFilterStatus('New Quote Request');
        } else {
            setFilterSource('');
            setFilterStatus('');
        }
        setCurrentPageFilter(1);
    }, [location.pathname]);

    useEffect(() => {
        if (location.state?.newLeadCreated) {
            toast.success('New Quote Request has been added!');
            setReFetchTrigger(prev => prev + 1);
            
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);


    const handleContactSaved = () => {
        toast.success(`Lead ${selectedLeadForAction ? 'updated' : 'added'} successfully!`);
        setIsAddContactModalOpen(false);
        setSelectedLeadForAction(null);
        setReFetchTrigger(prev => prev + 1);
    };

    const handleAddLeadClick = () => {
        setSelectedLeadForAction(null);
        setIsAddContactModalOpen(true);
    };

    const handleEditClick = (lead) => {
        setSelectedLeadForAction(lead);
        setIsAddContactModalOpen(true);
    };

    const handleDeleteClick = (lead) => {
        setLeadToDelete(lead);
        setActionToConfirm('delete');
        setIsConfirmationModalOpen(true);
    };

    const handleConvertClick = async (lead) => {
        if (!lead.email || lead.email.length === 0 || !lead.email.some(e => e.email.trim() !== '')) {
            toast.error("Cannot convert lead without a valid email address.");
            return;
        }

        setSelectedLeadForAction(lead);
        setActionToConfirm('convert');
        setIsConfirmationModalOpen(true);
    };

    const handleStatusChange = async (leadId, newStatus) => {
        if (newStatus === 'Converted') {
            const leadToConvert = leads.find(l => l._id === leadId);
            if (leadToConvert) {
                await handleConvertClick(leadToConvert);
            }
        } else {
            // Set editing status ID to show a visual cue (e.g., disable the select) if needed
            setEditingLeadStatusId(leadId); 
            try {
                await api.put(`/leads/${leadId}`, { leadStatus: newStatus });
                toast.success(`Lead status updated to ${newStatus}.`);
                setLeads(prevLeads =>
                    prevLeads.map(lead =>
                        lead._id === leadId ? { ...lead, leadStatus: newStatus } : lead
                    )
                );
            } catch (err) {
                console.error('Error updating lead status:', err);
                setError(err.response?.data?.message || 'Failed to update lead status.');
                toast.error(err.response?.data?.message || 'Failed to update lead status.');
            } finally {
                // Clear editing status ID regardless of success or failure
                setEditingLeadStatusId(null); 
            }
        }
    };

    const handleCheckboxChange = (leadId) => {
        setSelectedLeadIds(prev =>
            prev.includes(leadId)
                ? prev.filter(id => id !== leadId)
                : [...prev, leadId]
        );
    };

    const handleSelectAllChange = (e) => {
        if (e.target.checked) {
            const allLeadIds = leads.map(lead => lead._id);
            setSelectedLeadIds(allLeadIds);
        } else {
            setSelectedLeadIds([]);
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedLeadIds.length === 0) return;
        setSelectedLeadForAction(null);
        setActionToConfirm('bulk-delete');
        setIsConfirmationModalOpen(true);
    };

    const confirmAction = async () => {
        setLoading(true);
        setError(null);
        try {
            if (actionToConfirm === 'delete' && selectedLeadForAction) {
                await api.delete(`/leads/${selectedLeadForAction._id}`);
                toast.success('Lead deleted successfully!');
            } else if (actionToConfirm === 'bulk-delete' && selectedLeadIds.length > 0) {
                await api.post('/leads/bulk-delete', { ids: selectedLeadIds });
                toast.success(`${selectedLeadIds.length} leads deleted successfully!`);
            } else if (actionToConfirm === 'convert' && selectedLeadForAction) {
                const res = await api.post(`/leads/${selectedLeadForAction._id}/convert-to-customer`);
                toast.success(res.data.message);
            }
            setReFetchTrigger(prev => prev + 1);
        } catch (err) {
            console.error(`Error ${actionToConfirm}ing lead(s):`, err);
            setError(err.response?.data?.message || `Failed to ${actionToConfirm} lead(s).`);
            toast.error(err.response?.data?.message || `Failed to ${actionToConfirm} lead(s).`);
        } finally {
            setLoading(false);
            setIsConfirmationModalOpen(false);
            setSelectedLeadForAction(null);
            setActionToConfirm(null);
            setSelectedLeadIds([]);
        }
    };

    const getMasterContact = (contacts, type) => {
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return 'N/A';
        const master = contacts.find(c => c.isMaster);
        if (master) return type === 'email' ? master.email : master.number;
        const firstNonEmpty = contacts.find(c => (type === 'email' ? c.email : c.number)?.trim() !== '');
        return type === 'email' ? firstNonEmpty?.email : firstNonEmpty?.number;
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'New':
                return 'bg-blue-100 text-blue-800';
            case 'New Quote Request':
                return 'bg-purple-100 text-purple-800';
            case 'Contacted':
                return 'bg-yellow-100 text-yellow-800';
            case 'Qualified':
                return 'bg-green-100 text-green-800';
            case 'Unqualified':
            case 'Converted':
                return 'bg-teal-100 text-teal-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const isQuotesView = location.pathname === '/quotes';

    return (
        <div className="p-8 bg-white rounded-lg shadow-xl min-h-[calc(100vh-80px)]">
            <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h1 className="text-3xl font-extrabold text-gray-900">
                    {isQuotesView ? 'Quotes Management' : 'Leads Management'}
                </h1>
                <div className="flex space-x-4">
                    {selectedLeadIds.length > 0 && (
                        <button
                            onClick={handleBulkDeleteClick}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={selectedLeadIds.length === 0 || loading}
                        >
                            Delete Selected ({selectedLeadIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleAddLeadClick}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"
                    >
                        Add New {isQuotesView ? 'Quote' : 'Lead'}
                    </button>
                </div>
            </header>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <ModernInput
                    label="Search"
                    name="searchTerm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Search ${isQuotesView ? 'quotes' : 'leads'} by name, email, or company`}
                />
                <ModernSelect
                    label="Filter by Source"
                    name="filterSource"
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value)}
                    options={leadSourceOptions}
                />
                <ModernSelect
                    label="Filter by Status"
                    name="filterStatus"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    options={leadStatusOptions}
                />
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader /> <p className="ml-2 text-gray-600">Loading {isQuotesView ? 'quotes' : 'leads'}...</p>
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-gray-50 text-gray-600">
                    No {isQuotesView ? 'quotes' : 'leads'} found matching your criteria.
                </div>
            ) : (
                <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="p-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                        onChange={handleSelectAllChange}
                                        checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                                        disabled={loading}
                                    />
                                </th>
                                <th scope="col" className="px-6 py-3">Contact Person</th>
                                <th scope="col" className="px-6 py-3">Company Name</th>
                                <th scope="col" className="px-6 py-3">Email</th>
                                <th scope="col" className="px-6 py-3">Phone</th>
                                <th scope="col" className="px-6 py-3 min-w-[140px]">Status</th>
                                <th scope="col" className="px-6 py-3">Source</th>
                                <th scope="col" className="px-6 py-3">Sales Person</th>
                                <th scope="col" className="px-6 py-3">Commission Earned</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map(lead => (
                                <tr key={lead._id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="w-4 p-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            checked={selectedLeadIds.includes(lead._id)}
                                            onChange={() => handleCheckboxChange(lead._id)}
                                            disabled={loading}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                        {lead.contactPersonName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.companyName || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getMasterContact(lead.email, 'email') || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getMasterContact(lead.phone, 'phone') || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 min-w-[140px]">
                                        <div className="relative">
                                            <ModernSelect
                                                name="leadStatus"
                                                value={lead.leadStatus}
                                                onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                                                options={leadStatusOptions.filter(o => o.value !== '' && o.value !== 'Converted')}
                                                disabled={editingLeadStatusId === lead._id || loading} // Select will be disabled while an update is in progress
                                            />
                                            {/* Removed the loading overlay specific to status update here */}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.leadSource}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {lead.salesPersonName || 'Unassigned'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                        {lead.commissionEarned > 0 ? `£${lead.commissionEarned.toFixed(2)}` : '£0.00'}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end space-x-3">
                                            {lead.leadStatus !== 'Converted' && (
                                                <button
                                                    onClick={() => handleConvertClick(lead)}
                                                    className="font-medium text-green-600 hover:text-green-900"
                                                    title="Convert to Customer"
                                                >
                                                    Convert
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEditClick(lead)}
                                                className="font-medium text-blue-600 hover:text-blue-900"
                                                title="Edit Lead"
                                            >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(lead)}
                                                    className="font-medium text-red-600 hover:text-red-900"
                                                    title="Delete Lead"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {!loading && leads.length > 0 && (
                <div className="flex justify-between items-center mt-6 px-4 py-2 bg-white rounded-lg shadow-md">
                    <div>
                        Showing {(pagination.currentPage - 1) * leadsPerPage + 1} to {Math.min(pagination.currentPage * leadsPerPage, pagination.totalCount)} of {pagination.totalCount} results
                    </div>
                    <div className="flex items-center space-x-2">
                        {/* Make sure to import ChevronLeftIcon and ChevronRightIcon from @heroicons/react/24/outline */}
                        {/* import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'; */}
                        <button onClick={() => setCurrentPageFilter(prev => prev - 1)} disabled={pagination.currentPage <= 1} className="p-1 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <span className="text-sm font-medium text-gray-700">{pagination.currentPage} / {pagination.totalPages}</span>
                        <button onClick={() => setCurrentPageFilter(prev => prev + 1)} disabled={pagination.currentPage >= pagination.totalPages} className="p-1 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5 15.75 12l-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}


            {isAddContactModalOpen && (
                <AddContactModal
                    isOpen={isAddContactModalOpen}
                    onClose={() => setIsAddContactModalOpen(false)}
                    onContactAdded={handleContactSaved}
                    initialData={selectedLeadForAction}
                    type={selectedLeadForAction?.convertedFromLead ? 'customer' : 'lead'}
                    isMapsLoaded={isMapsLoaded}
                    isMapsLoadError={isMapsLoadError}
                />
            )}

            {isConfirmationModalOpen && (
                <ConfirmationModal
                    isOpen={isConfirmationModalOpen}
                    onClose={() => setIsConfirmationModalOpen(false)}
                    onConfirm={confirmAction}
                    title={
                        actionToConfirm === 'delete' ? 'Confirm Deletion' :
                        actionToConfirm === 'bulk-delete' ? `Confirm Bulk Deletion (${selectedLeadIds.length} Leads)` :
                        actionToConfirm === 'convert' ? 'Confirm Lead Conversion' : ''
                    }
                    message={
                        actionToConfirm === 'delete' ? `Are you sure you want to delete the ${isQuotesView ? 'quote' : 'lead'} "${selectedLeadForAction?.contactPersonName || 'N/A'}"? This action cannot be undone.` :
                        actionToConfirm === 'bulk-delete' ? `Are you sure you want to permanently delete the selected ${selectedLeadIds.length} ${isQuotesView ? 'quotes' : 'leads'}? This action cannot be undone.` :
                        actionToConfirm === 'convert' ? `Are you sure you want to convert "${selectedLeadForAction?.contactPersonName || 'this lead'}" to a new customer? This will create a new Customer record and mark the lead as 'Converted'.` : ''
                    }
                />
            )}
        </div>
    );
};

export default LeadsView;