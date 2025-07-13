const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Job = require('../models/Job');
const Staff = require('../models/Staff');
const StockItem = require('../models/StockItem');
const Invoice = require('../models/Invoice');
const DailyTimeRecord = require('../models/DailyTimeRecord');
const { startOfDay, endOfDay, startOfMonth, subMonths, parseISO, addMonths, format } = require('date-fns');
const mongoose = require('mongoose');

// Functions for the main dashboard (Assuming these are working correctly now)
const getSummaryStats = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const [totalCustomers, totalLeads, totalCompletedJobs, totalRevenueResult, lowStockItemsResult] = await Promise.all([
        Customer.countDocuments({ company: companyId }),
        Lead.countDocuments({ company: companyId }),
        Job.countDocuments({ company: companyId, status: 'Completed' }),
        Invoice.aggregate([
            { $match: { company: new mongoose.Types.ObjectId(companyId), status: { $in: ['Paid', 'Completed', 'paid', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]),
        StockItem.countDocuments({ company: companyId, $expr: { $lt: ['$stockQuantity', '$reorderLevel'] } })
    ]);
    res.status(200).json({
        totalCustomers: totalCustomers || 0,
        totalLeads: totalLeads || 0,
        totalRevenue: totalRevenueResult[0] ? totalRevenueResult[0].total : 0,
        totalCompletedJobs: totalCompletedJobs || 0,
        lowStockItemsCount: lowStockItemsResult || 0,
    });
});

const getJobsOverview = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date parameter is required.' });
    const todayStart = startOfDay(parseISO(date));
    const todayEnd = endOfDay(parseISO(date));
    const jobsToday = await Job.find({ company: companyId, date: { $gte: todayStart, $lte: todayEnd }, status: { $nin: ['Cancelled', 'cancelled'] } }).populate('customer', 'contactPersonName').select('customer serviceType time status address.street address.city').sort('time').lean();
    const upcomingJobsCount = await Job.countDocuments({ company: companyId, date: { $gt: todayEnd }, status: { $in: ['Scheduled', 'In Progress', 'scheduled', 'in_progress'] } });
    res.status(200).json({
        totalJobsToday: jobsToday.length,
        upcomingJobsCount: upcomingJobsCount,
        jobsToday: jobsToday.map(job => ({ id: job._id, customerName: job.customer?.contactPersonName || 'N/A', type: job.serviceType, time: job.time, status: job.status, address: job.address || {} }))
    });
});

const getJobsByStatus = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const jobStatusCounts = await Job.aggregate([
        { $match: { company: new mongoose.Types.ObjectId(companyId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } }
    ]);
    const formattedCounts = jobStatusCounts.reduce((acc, item) => { acc[item.status] = item.count; return acc; }, {});
    res.status(200).json(formattedCounts);
});

const getStaffAvailability = asyncHandler(async (req, res) => {
    res.status(200).json({ 'On Duty (Clocked In)': 2, 'On Job': 3, 'On Leave': 1, 'Off Duty': 4 });
});

const getRecentActivity = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const limit = 3;
    const [latestJobs, latestInvoices, newLeads] = await Promise.all([
        Job.find({ company: companyId }).sort({ createdAt: -1 }).limit(limit).populate('customer', 'contactPersonName').lean(),
        Invoice.find({ company: companyId }).sort({ createdAt: -1 }).limit(limit).populate('customer', 'contactPersonName').lean(),
        Lead.find({ company: companyId }).sort({ createdAt: -1 }).limit(limit).lean()
    ]);
    res.status(200).json({
        jobs: latestJobs.map(j => ({ id: j._id, type: j.serviceType, customer: j.customer?.contactPersonName || 'N/A', date: j.date })),
        invoices: latestInvoices.map(i => ({ id: i._id, number: i.invoiceNumber, amount: i.total, customer: i.customer?.contactPersonName || 'N/A' })),
        leads: newLeads.map(l => ({ id: l._id, name: l.contactPersonName, source: l.leadSource }))
    });
});

/**
 * @desc    Get advanced financial data for dashboard (KPIs, charts, breakdowns)
 * @route   GET /api/dashboard/financials
 * @access  Private (Admin, Manager)
 */
const getFinancialData = asyncHandler(async (req, res) => {
    const companyId = req.user.company;
    const { startDate, endDate, staffId, customerId, stockId } = req.query; // Added new filter parameters

    if (!startDate || !endDate) {
        const defaultEnd = endOfDay(new Date());
        const defaultStart = startOfMonth(subMonths(defaultEnd, 11));
        return res.status(400).json({
            message: 'startDate and endDate are required parameters for this financial report. Please provide them.',
            defaultStart: format(defaultStart, 'yyyy-MM-dd'),
            defaultEnd: format(defaultEnd, 'yyyy-MM-dd')
        });
    }
    
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    // Base match criteria for the aggregation
    let baseMatchCriteria = {
        company: new mongoose.Types.ObjectId(companyId),
        status: { $in: ['Completed', 'Invoiced'] }, 
        createdAt: { $gte: start, $lte: end }
    };

    // Add conditional filters based on query parameters
    if (staffId) {
        baseMatchCriteria.staff = new mongoose.Types.ObjectId(staffId);
    }
    if (customerId) {
        baseMatchCriteria.customer = new mongoose.Types.ObjectId(customerId);
    }
    // Note: Stock filtering needs careful consideration as 'usedStock' is an array.
    // We'll apply it *after* unwinding and looking up stock items.

    const financialData = await Job.aggregate([
        {
            $match: baseMatchCriteria // Apply base filters first
        },
        {
            $lookup: {
                from: 'invoices',
                localField: '_id',
                foreignField: 'job',
                as: 'invoiceDetails'
            }
        },
        {
            $unwind: {
                path: '$invoiceDetails',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'customers',
                localField: 'customer',
                foreignField: '_id',
                as: 'customerInfo'
            }
        },
        {
            $unwind: {
                path: '$customerInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'staffs',
                localField: 'staff',
                foreignField: '_id',
                as: 'staffInfo'
            }
        },
        {
            $unwind: {
                path: '$usedStock',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'stockitems',
                localField: 'usedStock.stockId',
                foreignField: '_id',
                as: 'stockItemDetails'
            }
        },
        {
            $unwind: {
                path: '$stockItemDetails',
                preserveNullAndEmptyArrays: true
            }
        },
        // Apply stock filter here, after unwinding stock items
        stockId ? { $match: { 'stockItemDetails._id': new mongoose.Types.ObjectId(stockId) } } : { $limit: 999999999 }, // Use $limit to essentially do nothing if no stockId, but maintain pipeline structure for $match
        {
            $addFields: {
                'usedStock.cost': {
                    $multiply: [
                        { $ifNull: ['$usedStock.quantity', 0] },
                        { $ifNull: ['$stockItemDetails.purchasePrice', 0] }
                    ]
                },
                'monthYear': { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: { $ifNull: ['$invoiceDetails.total', 0] } },
                totalCOGS: { $sum: { $ifNull: ['$usedStock.cost', 0] } },

                revenueByMonth: {
                    $push: {
                        month: '$monthYear',
                        revenue: { $ifNull: ['$invoiceDetails.total', 0] },
                        cogs: { $ifNull: ['$usedStock.cost', 0] }
                    }
                },

                staffRevenue: {
                    $push: {
                        staffId: { $arrayElemAt: ['$staffInfo._id', 0] },
                        staffName: { $arrayElemAt: ['$staffInfo.contactPersonName', 0] },
                        jobPrice: { $ifNull: ['$invoiceDetails.total', 0] }
                    }
                },

                customerRevenue: {
                    $push: {
                        customerId: '$customerInfo._id',
                        customerName: '$customerInfo.contactPersonName',
                        invoiceTotal: { $ifNull: ['$invoiceDetails.total', 0] }
                    }
                },

                stockUsageCosts: {
                    $push: {
                        stockId: '$stockItemDetails._id',
                        stockName: '$stockItemDetails.name',
                        quantityUsed: { $ifNull: ['$usedStock.quantity', 0] },
                        totalCost: { $ifNull: ['$usedStock.cost', 0] }
                    }
                },
            }
        },
        {
            $addFields: {
                grossProfit: { $subtract: ['$totalRevenue', '$totalCOGS'] },
                profitMargin: {
                    $cond: {
                        if: { $gt: ['$totalRevenue', 0] },
                        then: { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCOGS'] }, '$totalRevenue'] }, 100] },
                        else: 0
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalRevenue: 1,
                totalCOGS: 1,
                grossProfit: 1,
                profitMargin: 1,
                
                revenueByMonth: {
                    $reduce: {
                        input: '$revenueByMonth',
                        initialValue: [],
                        in: {
                            $let: {
                                vars: {
                                    existingMonth: {
                                        $filter: {
                                            input: '$$value',
                                            as: 'm',
                                            cond: { $eq: ['$$m.month', '$$this.month'] }
                                        }
                                    }
                                },
                                in: {
                                    $cond: {
                                        if: { $gt: [{ $size: '$$existingMonth' }, 0] },
                                        then: {
                                            $map: {
                                                input: '$$value',
                                                as: 'm',
                                                in: {
                                                    $cond: {
                                                        if: { $eq: ['$$m.month', '$$this.month'] },
                                                        then: {
                                                            month: '$$m.month',
                                                            revenue: { $add: ['$$m.revenue', '$$this.revenue'] },
                                                            cogs: { $add: ['$$m.cogs', '$$this.cogs'] }
                                                        },
                                                        else: '$$m'
                                                    }
                                                }
                                            }
                                        },
                                        else: { $concatArrays: ['$$value', [{ month: '$$this.month', revenue: '$$this.revenue', cogs: '$$this.cogs' }]] }
                                    }
                                }
                            }
                        }
                    }
                },

                staffPerformance: {
                    $filter: {
                        input: {
                            $reduce: {
                                input: '$staffRevenue',
                                initialValue: [],
                                in: {
                                    $let: {
                                        vars: {
                                            existingStaff: {
                                                $filter: {
                                                    input: '$$value',
                                                    as: 's',
                                                    cond: { $eq: ['$$s.staffId', '$$this.staffId'] }
                                                }
                                            }
                                        },
                                        in: {
                                            $cond: {
                                                if: { $gt: [{ $size: '$$existingStaff' }, 0] },
                                                then: {
                                                    $map: {
                                                        input: '$$value',
                                                        as: 's',
                                                        in: {
                                                            $cond: {
                                                                if: { $eq: ['$$s.staffId', '$$this.staffId'] },
                                                                then: {
                                                                    staffId: '$$s.staffId',
                                                                    staffName: '$$s.staffName',
                                                                    totalRevenue: { $add: ['$$s.totalRevenue', '$$this.jobPrice'] }
                                                                },
                                                                else: '$$s'
                                                            }
                                                        }
                                                    }
                                                },
                                                else: { $concatArrays: ['$$value', [{ staffId: '$$this.staffId', staffName: '$$this.staffName', totalRevenue: '$$this.jobPrice' }]] }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        as: 's',
                        cond: { $ne: ['$$s.staffId', null] }
                    }
                },

                customerPerformance: {
                    $filter: {
                        input: {
                            $reduce: {
                                input: '$customerRevenue',
                                initialValue: [],
                                in: {
                                    $let: {
                                        vars: {
                                            existingCustomer: {
                                                $filter: {
                                                    input: '$$value',
                                                    as: 'c',
                                                    cond: { $eq: ['$$c.customerId', '$$this.customerId'] }
                                                }
                                            }
                                        },
                                        in: {
                                            $cond: {
                                                if: { $gt: [{ $size: '$$existingCustomer' }, 0] },
                                                then: {
                                                    $map: {
                                                        input: '$$value',
                                                        as: 'c',
                                                        in: {
                                                            $cond: {
                                                                if: { $eq: ['$$c.customerId', '$$this.customerId'] },
                                                                then: {
                                                                    customerId: '$$c.customerId',
                                                                    customerName: '$$c.customerName',
                                                                    totalRevenue: { $add: ['$$c.totalRevenue', '$$this.invoiceTotal'] }
                                                                },
                                                                else: '$$c'
                                                            }
                                                        }
                                                    }
                                                },
                                                else: { $concatArrays: ['$$value', [{ customerId: '$$this.customerId', customerName: '$$this.customerName', totalRevenue: '$$this.invoiceTotal' }]] }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        as: 'c',
                        cond: { $ne: ['$$c.customerId', null] }
                    }
                },

                stockUsageCosts: {
                    $filter: {
                        input: {
                            $reduce: {
                                input: '$stockUsageCosts',
                                initialValue: [],
                                in: {
                                    $let: {
                                        vars: {
                                            existingStock: {
                                                $filter: {
                                                    input: '$$value',
                                                    as: 's',
                                                    cond: { $eq: ['$$s.stockId', '$$this.stockId'] }
                                                }
                                            }
                                        },
                                        in: {
                                            $cond: {
                                                if: { $gt: [{ $size: '$$existingStock' }, 0] },
                                                then: {
                                                    $map: {
                                                        input: '$$value',
                                                        as: 's',
                                                        in: {
                                                            $cond: {
                                                                if: { $eq: ['$$s.stockId', '$$this.stockId'] },
                                                                then: {
                                                                    stockId: '$$s.stockId',
                                                                    stockName: '$$s.stockName',
                                                                    quantityUsed: { $add: ['$$s.quantityUsed', '$$this.quantityUsed'] },
                                                                    totalCost: { $add: ['$$s.totalCost', '$$this.totalCost'] }
                                                                },
                                                                else: '$$s'
                                                            }
                                                        }
                                                    }
                                                },
                                                else: { $concatArrays: ['$$value', [{ stockId: '$$this.stockId', stockName: '$$this.stockName', quantityUsed: '$$this.quantityUsed', totalCost: '$$this.totalCost' }]] }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        as: 's',
                        cond: { $ne: ['$$s.stockId', null] }
                    }
                }
            }
        }
    ]);

    const result = financialData[0] || {};

    const [outstandingInvoicesResult, overdueInvoicesResultData] = await Promise.all([
        Invoice.aggregate([
            {
                $match: {
                    company: new mongoose.Types.ObjectId(companyId),
                    status: { $in: ['sent', 'partially_paid'] },
                    balanceDue: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOutstanding: { $sum: '$balanceDue' }
                }
            }
        ]),
        Invoice.aggregate([
            {
                $match: {
                    company: new mongoose.Types.ObjectId(companyId),
                    status: 'overdue',
                    balanceDue: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOverdue: { $sum: '$balanceDue' },
                    overdueInvoicesList: {
                        $push: {
                            invoiceId: '$_id',
                            invoiceNumber: '$invoiceNumber',
                            customer: '$customer',
                            dueDate: '$dueDate',
                            balanceDue: '$balanceDue'
                        }
                    }
                }
            },
            {
                $unwind: '$overdueInvoicesList'
            },
            {
                $lookup: {
                    from: 'customers',
                    localField: 'overdueInvoicesList.customer',
                    foreignField: '_id',
                    as: 'overdueInvoicesList.customerInfo'
                }
            },
            {
                $unwind: {
                    path: '$overdueInvoicesList.customerInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: null,
                    totalOverdue: { $first: '$totalOverdue' },
                    overdueInvoicesList: {
                        $push: {
                            invoiceId: '$overdueInvoicesList.invoiceId',
                            invoiceNumber: '$overdueInvoicesList.invoiceNumber',
                            customerName: { $ifNull: ['$overdueInvoicesList.customerInfo.contactPersonName', 'N/A'] },
                            dueDate: '$overdueInvoicesList.dueDate',
                            balanceDue: '$overdueInvoicesList.balanceDue'
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalOverdue: 1,
                    overdueInvoices: {
                        $slice: [
                            { $sortArray: { input: '$overdueInvoicesList', sortBy: { balanceDue: -1 } } },
                            5
                        ]
                    }
                }
            }
        ])
    ]);

    const monthlyDataMap = new Map(result.revenueByMonth?.map(item => [`${item.month}`, item]) || []);
    const allMonths = [];
    let currentMonth = startOfMonth(start);
    while (currentMonth <= end) {
        const monthKey = format(currentMonth, 'yyyy-MM');
        if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, { month: monthKey, revenue: 0, cogs: 0 });
        }
        allMonths.push(monthKey);
        currentMonth = addMonths(currentMonth, 1);
    }
    const sortedRevenueByMonth = Array.from(monthlyDataMap.values()).sort((a, b) => a.month.localeCompare(b.month));


    res.status(200).json({
        totalRevenue: result.totalRevenue || 0,
        totalCOGS: result.totalCOGS || 0,
        grossProfit: result.grossProfit || 0,
        profitMargin: result.profitMargin || 0,
        outstandingBalance: outstandingInvoicesResult[0]?.totalOutstanding || 0,
        overdueBalance: overdueInvoicesResultData[0]?.totalOverdue || 0,
        overdueInvoices: overdueInvoicesResultData[0]?.overdueInvoices || [],

        revenueByMonth: sortedRevenueByMonth.map(item => ({
            month: item.month,
            revenue: item.revenue,
            cogs: item.cogs,
            profit: item.revenue - item.cogs
        })),

        staffPerformance: result.staffPerformance?.sort((a, b) => b.totalRevenue - a.totalRevenue) || [],
        customerPerformance: result.customerPerformance?.sort((a, b) => b.totalRevenue - a.totalRevenue) || [],
        stockUsageCosts: result.stockUsageCosts?.sort((a, b) => b.totalCost - a.totalCost) || [],
    });
});

// Exports
module.exports = {
    getSummaryStats,
    getJobsOverview,
    getJobsByStatus,
    getStaffAvailability,
    getRecentActivity,
    getFinancialData
};