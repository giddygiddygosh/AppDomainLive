import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// --- Heroicons from @heroicons/react/24/outline ---
import {
    HomeIcon,
    UsersIcon,
    FolderIcon,
    CalendarIcon,
    ChartPieIcon,
    Cog6ToothIcon,
    XMarkIcon,
    EnvelopeIcon,
    BriefcaseIcon,
    MapPinIcon,
    CurrencyDollarIcon,
    Bars3Icon, // Added for a potential toggle icon in the header
} from '@heroicons/react/24/outline';

// --- Lucide-React Icons ---
import {
    LayoutDashboard,
    CheckCircle,
    Megaphone,
    ReceiptText,
    LineChart,
    Package,
} from 'lucide-react';


const Sidebar = ({ isOpen, toggleSidebar, user, logout }) => {
    const location = useLocation();
    const userRole = user?.role;
    const { t } = useTranslation();

    const classNames = (...classes) => {
        return classes.filter(Boolean).join(' ')
    }

    const isCurrent = (href) => {
        // This logic handles active states for parent paths like /dashboard or /jobs
        if (href === '/dashboard' || href === '/staff-dashboard' || href === '/customer-portal' || href === '/my-payslips' || href === '/jobs') {
            return location.pathname.startsWith(href);
        }
        return location.pathname === href;
    };


    // Define ALL navigation items with their respective roles
    const navigation = [
        // Dashboards
        { name: t('sidebar.dashboard'), href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
        { name: t('sidebar.staffDashboard'), href: '/staff-dashboard', icon: HomeIcon, roles: ['staff'] },
        { name: t('sidebar.customerPortal'), href: '/customer-portal', icon: UsersIcon, roles: ['customer'] },

        // CRM & People Management
        { name: t('sidebar.customers'), href: '/customers', icon: UsersIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.leads'), href: '/leads', icon: Megaphone, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.staff'), href: '/staff', icon: UsersIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.staffAbsence'), href: '/staff-absence', icon: BriefcaseIcon, roles: ['admin', 'manager'] },

        // Operations & Scheduling
        { name: t('sidebar.scheduler'), href: '/scheduler', icon: CalendarIcon, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.routePlanner'), href: '/route-planner', icon: MapPinIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.spotChecker'), href: '/spot-checker', icon: CheckCircle, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.jobs'), href: '/jobs', icon: BriefcaseIcon, roles: ['admin', 'manager', 'staff'] },

        // Inventory & Invoicing
        { name: t('sidebar.stock'), href: '/stock', icon: Package, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.invoices'), href: '/invoices', icon: ReceiptText, roles: ['admin', 'manager', 'staff'] },

        // Financials (Payroll & Reports)
        { name: t('sidebar.payroll'), href: '/payroll', icon: CurrencyDollarIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.myPayslips'), href: '/my-payslips', icon: CurrencyDollarIcon, roles: ['staff'] },
        { name: t('sidebar.commissionReport'), href: '/commission-report', icon: LineChart, roles: ['admin', 'manager'] },

        // Tools & Automation
        { name: t('sidebar.emailTemplates'), href: '/email-templates', icon: EnvelopeIcon, roles: ['admin'] },
        { name: t('sidebar.formBuilder'), href: '/form-builder', icon: ChartPieIcon, roles: ['admin'] },
        { name: t('sidebar.settings'), href: '/settings', icon: Cog6ToothIcon, roles: ['admin'] },
    ].filter(item => item.roles.includes(userRole));


    return (
        <>
            {/* Overlay for mobile when sidebar is open */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-gray-900 bg-opacity-75 z-10 md:hidden"
                    onClick={toggleSidebar}
                    aria-hidden="true"
                ></div>
            )}

            <div
                className={`fixed inset-y-0 left-0 bg-gray-800 text-gray-200 shadow-xl
                            transition-all duration-300 ease-in-out z-20
                            ${isOpen ? 'w-64' : 'w-20'}
                            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} `}
            >
                {/* Sidebar Header */}
                <div className="flex items-center h-16 px-4 border-b border-gray-700">
                    {/* Mobile close button (XMarkIcon) */}
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500
                                   md:hidden" // Only show on mobile
                        aria-label="Close sidebar"
                    >
                        <XMarkIcon className="h-6 w-6 text-gray-300" />
                    </button>

                    {/* App Title when expanded */}
                    {isOpen && <span className="ml-2 text-xl font-bold text-white tracking-wide">{t('appTitle')}</span>}

                    {/* Desktop collapse/expand button (Hamburger icon) */}
                    {!isOpen && (
                        <button
                            onClick={toggleSidebar}
                            className="p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 hidden md:block w-full text-center"
                            aria-label="Expand sidebar"
                        >
                            <Bars3Icon className="h-6 w-6 text-gray-300 mx-auto" /> {/* Center icon */}
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex flex-col flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={classNames(
                                isCurrent(item.href)
                                    ? 'bg-indigo-600 text-white' // Stronger indigo for active link
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white', // Consistent dark background, lighter hover
                                'group flex items-center px-2 py-2 font-medium rounded-md',
                                isOpen ? 'text-sm' : 'justify-center' // Center icons when collapsed
                            )}
                            aria-label={item.name} // Accessibility for collapsed state
                        >
                            <item.icon
                                className={classNames(
                                    isCurrent(item.href) ? 'text-white' : 'text-gray-400 group-hover:text-white', // Icon colors
                                    isOpen ? 'mr-3' : 'mr-0', // Remove margin when collapsed
                                    'flex-shrink-0 h-6 w-6'
                                )}
                                aria-hidden="true"
                            />
                            <span className={`${isOpen ? 'block' : 'hidden'}`}>{item.name}</span>
                        </Link>
                    ))}
                </nav>

                {/* User Info and Logout */}
                <div className={`absolute bottom-0 left-0 w-full p-4 border-t border-gray-700 text-gray-400
                                ${isOpen ? 'block' : 'hidden md:block'} `} // Only show if open, or always hidden on mobile when collapsed
                >
                    <div className={`${isOpen ? 'block' : 'hidden'}`}>
                        <p className="text-sm">{t('sidebar.loggedInAs')}: <br /><span className="font-semibold text-white">{user?.contactPersonName || user?.email}</span></p>
                        <p className="text-sm mt-1">{t('sidebar.role')}: {t(`roles.${userRole}`)}</p>
                        <button
                            onClick={logout}
                            className="mt-4 text-sm font-medium text-red-400 hover:text-red-300 flex items-center px-3 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 w-full" // Larger button, full width, with hover
                        >
                            <svg className="h-5 w-5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            {t('sidebar.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;