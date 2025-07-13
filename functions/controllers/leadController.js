// ServiceOS/backend/controllers/leadController.js

const Lead = require('../models/Lead');
const mongoose = require('mongoose');


/**
 * @desc Create a new lead
 * @route POST /api/leads
 * @access Private (Admin, Staff, Manager)
 */
exports.createLead = async (req, res) => {
    try {
        const { companyName, contactPersonName, email, phone, address, leadStatus, leadSource, notes, salesPersonName, commissionType, commissionValue } = req.body;
        const companyId = req.user.company;

        if (!contactPersonName) {
            return res.status(400).json({ message: 'Contact person name is required' });
        }
        if (!companyId) {
            return res.status(400).json({ message: 'User is not associated with a company.' });
        }

        if (Array.isArray(email)) {
            if (!email.some(e => e.email.trim() !== '')) {
                return res.status(400).json({ message: 'At least one valid Email address is required.' });
            }
        } else if (email && !/.+@.+\..+/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format for lead.' });
        }

        const newLead = new Lead({
            company: companyId,
            companyName,
            contactPersonName,
            email,
            phone,
            address,
            leadStatus,
            leadSource,
            notes,
            salesPersonName,
            commissionType,
            commissionValue,
            createdBy: req.user._id,
        });

        await newLead.save();
        res.status(201).json({ message: 'Lead created successfully', lead: newLead });
    } catch (error) {
        console.error('Error creating lead:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};


/**
 * @desc Get all leads for a company with optional filters, search, and pagination
 * @route GET /api/leads
 * @access Private (Admin, Manager, Staff)
 */
exports.getLeads = async (req, res) => {
    try {
        const companyId = req.user.company;
        const { page = 1, limit = 10, sort = '-createdAt', search, status } = req.query;

        let query = { company: companyId };
        
        // Apply status filter if provided and not "All Statuses"
        if (status && status !== '' && status !== 'All Statuses') {
            query.leadStatus = status;
        }

        // Apply search filter if provided
        if (search) {
            query.$or = [
                { contactPersonName: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { 'email.email': { $regex: search, $options: 'i' } } // Assuming email is an array of objects
            ];
        }

        const options = {
            limit: parseInt(limit, 10),
            skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
            sort: sort.split(',').join(' '), // Convert comma-separated sort string to space-separated for Mongoose
            lean: true // Return plain JavaScript objects rather than Mongoose documents
        };

        const leads = await Lead.find(query, null, options);
        const totalCount = await Lead.countDocuments(query);

        res.status(200).json({
            leads,
            totalCount,
            currentPage: parseInt(page, 10),
            totalPages: Math.ceil(totalCount / parseInt(limit, 10))
        });

    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Get a single lead by ID
 * @route GET /api/leads/:id
 * @access Private (Admin, Manager, Staff)
 */
exports.getLeadById = async (req, res) => {
    try {
        const lead = await Lead.findOne({ _id: req.params.id, company: req.user.company });

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        res.status(200).json(lead);
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Update a lead by ID
 * @route PUT /api/leads/:id
 * @access Private (Admin, Manager, Staff)
 */
exports.updateLead = async (req, res) => {
    try {
        const { companyName, contactPersonName, email, phone, address, leadStatus, leadSource, notes, salesPersonName, commissionType, commissionValue } = req.body;
        const leadId = req.params.id;
        const companyId = req.user.company;

        const lead = await Lead.findOne({ _id: leadId, company: companyId });

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found or not authorized' });
        }

        if (leadStatus && leadStatus === 'Converted' && lead.leadStatus !== 'Converted') {
            return res.status(400).json({ message: 'Cannot convert lead via update. Use the dedicated conversion flow.' });
        }

        if (lead.leadStatus === 'Converted' && leadStatus && leadStatus !== 'Converted') {
            return res.status(400).json({ message: 'Cannot revert a converted lead status from this endpoint.' });
        }

        const updateFields = {
            companyName,
            contactPersonName,
            email,
            phone,
            address,
            leadSource,
            notes,
            salesPersonName,
            commissionType,
            commissionValue,
            updatedAt: Date.now()
        };

        // Only allow leadStatus update if it's not 'Converted' or if it's changing to 'Converted' via the dedicated flow
        // The previous logic was correct, this ensures it's not changed back from 'Converted' via this generic update
        if (lead.leadStatus !== 'Converted' || (lead.leadStatus === 'Converted' && leadStatus === 'Converted')) {
             updateFields.leadStatus = leadStatus;
        }

        const updatedLead = await Lead.findByIdAndUpdate(
            leadId,
            updateFields,
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
    } catch (error) {
        console.error('Error updating lead:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: `Validation failed: ${errors.join(', ')}` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Mark a lead as 'Converted' on the backend.
 * This is a precursor to actual customer creation on the frontend.
 * @route POST /api/leads/:id/mark-converted
 * @access Private (Admin, Manager, Staff)
 */
exports.markLeadAsConverted = async (req, res) => {
    try {
        const leadId = req.params.id;
        const companyId = req.user.company;

        const lead = await Lead.findOne({ _id: leadId, company: companyId });

        if (!lead) {
            return res.status(404).json({ message: 'Lead not found or not authorized' });
        }

        if (lead.leadStatus === 'Converted') {
            return res.status(400).json({ message: 'Lead is already marked as converted.' });
        }

        lead.leadStatus = 'Converted';
        lead.conversionDate = new Date();
        lead.commissionEarned = 0; // Reset as actual commission will be on customer
        await lead.save();

        res.status(200).json({
            message: `Lead "${lead.contactPersonName}" marked as converted.`,
            lead: lead
        });

    } catch (error) {
        console.error('Error marking lead as converted:', error);
        res.status(500).json({ message: 'Failed to mark lead as converted', error: error.message });
    }
};


/**
 * @desc Delete a lead by ID
 * @route DELETE /api/leads/:id
 * @access Private (Admin)
 */
exports.deleteLead = async (req, res) => {
    try {
        const deletedLead = await Lead.findOneAndDelete({ _id: req.params.id, company: req.user.company });

        if (!deletedLead) {
            return res.status(404).json({ message: 'Lead not found or not authorized' });
        }
        res.status(200).json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Bulk delete leads by IDs
 * @route POST /api/leads/bulk-delete
 * @access Private (Admin, Manager)
 */
exports.bulkDeleteLeads = async (req, res) => {
    try {
        const { ids } = req.body;
        const companyId = req.user.company;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No lead IDs provided for bulk deletion.' });
        }

        const result = await Lead.deleteMany({ _id: { $in: ids }, company: companyId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No leads found for deletion with the provided IDs or authorization.' });
        }

        res.status(200).json({ message: `${result.deletedCount} leads deleted successfully.` });
    } catch (error) {
        console.error('Error bulk deleting leads:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc Bulk upload leads from CSV
 * @route POST /api/leads/bulk-upload
 * @access Private (Admin, Manager)
 */
exports.bulkUploadLeads = async (req, res) => {
    try {
        const leadsData = req.body.leads;

        if (!Array.isArray(leadsData) || leadsData.length === 0) {
            return res.status(400).json({ message: 'No lead data provided for bulk upload.' });
        }

        const companyId = req.user.company;
        const leadsToInsert = leadsData.map(lead => ({
            ...lead,
            company: companyId,
            leadStatus: lead.leadStatus || 'New',
            leadSource: lead.leadSource || 'Other',
        }));

        const result = await Lead.insertMany(leadsToInsert);
        res.status(201).json({ message: `${result.length} leads uploaded successfully.`, leads: result });
    } catch (error) {
        console.error('Error bulk uploading leads:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createLead: exports.createLead,
    getLeads: exports.getLeads,
    getLeadById: exports.getLeadById,
    updateLead: exports.updateLead,
    deleteLead: exports.deleteLead,
    bulkDeleteLeads: exports.bulkDeleteLeads,
    markLeadAsConverted: exports.markLeadAsConverted,
    bulkUploadLeads: exports.bulkUploadLeads,
};