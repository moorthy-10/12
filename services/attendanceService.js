'use strict';

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

/**
 * Admin Attendance Override Logic
 */
async function adminOverrideAttendance({ adminId, user_id, date, status, check_in, check_out, reason }) {
    try {
        // Ensure user_id is a string if an object was passed
        const targetUserId = (typeof user_id === 'object' && user_id._id) ? user_id._id : user_id;

        const existing = await Attendance.findOne({ user: targetUserId, date });

        const updateData = {
            status,
            is_manual: true,
            updated_by: adminId,
            notes: reason || ''
        };

        // Convert string times/dates to proper Date objects if provided
        if (check_in) {
            updateData.clockIn = new Date(check_in);
            updateData.check_in_time = new Date(check_in).toLocaleTimeString('en-GB', {
                timeZone: 'Asia/Kolkata',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        if (check_out) {
            updateData.clockOut = new Date(check_out);
            updateData.check_out_time = new Date(check_out).toLocaleTimeString('en-GB', {
                timeZone: 'Asia/Kolkata',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Calculate totalHours if both are available
        if (updateData.clockIn && updateData.clockOut) {
            const diffMs = updateData.clockOut - updateData.clockIn;
            if (diffMs > 0) {
                updateData.totalHours = parseFloat((diffMs / 3600000).toFixed(2));
            }
        }

        if (existing) {
            // Track history
            const historyEntry = {
                edited_by: adminId,
                old_check_in: existing.clockIn,
                old_check_out: existing.clockOut,
                edited_at: new Date(),
                reason: reason || 'Manual adjustment'
            };

            return await Attendance.findByIdAndUpdate(existing._id, {
                $set: updateData,
                $push: { edit_history: historyEntry }
            }, { new: true });
        } else {
            // New record
            updateData.user = targetUserId;
            updateData.date = date;
            updateData.created_by = adminId;
            return await Attendance.create(updateData);
        }
    } catch (error) {
        throw error;
    }
}

/**
 * Unified Attendance Report Logic with Scoping
 */
async function generateAttendanceReport({ start, end, userObj, department, exportMode, res }) {
    const filter = {
        date: { $gte: start, $lte: end }
    };

    const roles = userObj.roles || [userObj.role]; // Support both legacy and new roles
    const isHrAdmin = roles.includes('hr_admin') || roles.includes('admin');
    const isHr = roles.includes('hr');
    const isManager = roles.includes('manager');

    // Data Scope Enforcement
    if (isHrAdmin) {
        // Access all users
        if (department) {
            // If department filter provided, scope down
            const usersInDept = await User.find({
                $or: [{ department_ref: department }, { department: department }]
            }).select('_id');
            filter.user = { $in: usersInDept.map(u => u._id) };
        }
    } else if (isHr) {
        // scope to department
        const targetDept = department || userObj.department_ref || userObj.department;
        const usersInDept = await User.find({
            $or: [{ department_ref: targetDept }, { department: targetDept }]
        }).select('_id');
        filter.user = { $in: usersInDept.map(u => u._id) };
    } else if (isManager) {
        // scope to direct reports
        const reports = await User.find({ reports_to: userObj.id }).select('_id');
        const reportIds = reports.map(u => u._id);
        reportIds.push(userObj.id); // Manager can see their own
        filter.user = { $in: reportIds };
    } else {
        // Intern / Employee (Self only)
        filter.user = userObj.id;
    }

    if (exportMode) {
        return await streamAttendanceExcel(res, filter, start, end);
    }

    const records = await Attendance.find(filter)
        .populate('user', 'name email department position')
        .sort({ date: -1 });

    return records.map(r => {
        const obj = r.toJSON();
        obj.user_name = r.user?.name || 'Unknown';
        obj.email = r.user?.email || '';
        obj.department = r.user?.department || '';
        return obj;
    });
}

/**
 * Stream Excel Export
 */
async function streamAttendanceExcel(res, filter, start, end) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance Report');

    sheet.columns = [
        { header: 'Employee Name', key: 'name', width: 24 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Check In', key: 'check_in', width: 12 },
        { header: 'Check Out', key: 'check_out', width: 12 },
        { header: 'Total Hours', key: 'hours', width: 14 },
        { header: 'Manual Edit', key: 'manual', width: 12 },
        { header: 'Notes/Reason', key: 'notes', width: 30 }
    ];

    // Style the header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F3A5F' } // Premium Deep Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    const cursor = Attendance.find(filter)
        .populate('user', 'name')
        .sort({ date: 1 })
        .cursor();

    let rowCount = 1;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        rowCount++;
        const row = sheet.addRow({
            name: doc.user?.name || 'Unknown',
            date: doc.date,
            status: doc.status.toUpperCase(),
            check_in: doc.check_in_time || '-',
            check_out: doc.check_out_time || '-',
            hours: doc.totalHours ? `${doc.totalHours} hrs` : '-',
            manual: doc.is_manual ? 'YES' : 'No',
            notes: doc.notes || ''
        });

        // Zebra striping and alignment
        const fill = rowCount % 2 === 0 ? 'FFF0F4FA' : 'FFFFFFFF';
        row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
        });
    }

    // Auto-filter for easy data exploration
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rowCount, column: 8 }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${start}_to_${end}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
}

module.exports = {
    adminOverrideAttendance,
    generateAttendanceReport
};
