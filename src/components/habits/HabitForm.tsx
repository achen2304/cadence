"use client";

import { useCallback, useState } from "react";
import { HABIT_COLORS, GRID_RANGE_OPTIONS } from "@/lib/constants";
import type { ScheduleType } from "@/lib/constants";
import type { Habit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface HabitFormProps {
  habit?: Habit;
  onSave: (habit: Habit) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  daily: "Daily",
  every_other_day: "Every Other Day",
  days_of_week: "Days of Week",
  days_of_month: "Days of Month",
};

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function HabitForm({ habit, onSave, onArchive, onDelete }: HabitFormProps) {
  const isEdit = !!habit;

  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[3].hex);
  const [icon, setIcon] = useState(habit?.icon ?? "");
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    habit?.schedule.type ?? "daily"
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    habit?.schedule.daysOfWeek ?? []
  );
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>(
    habit?.schedule.daysOfMonth ?? []
  );
  const [anchorDate, setAnchorDate] = useState(
    habit?.schedule.anchorDate ?? ""
  );
  const [gridRange, setGridRange] = useState(habit?.gridRange ?? 90);
  const [notifEnabled, setNotifEnabled] = useState(
    habit?.notification.enabled ?? false
  );
  const [notifTime, setNotifTime] = useState(
    habit?.notification.time ?? "09:00"
  );
  const [saving, setSaving] = useState(false);

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleDayOfMonth = (day: number) => {
    setDaysOfMonth((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || saving) return;

      setSaving(true);

      const body = {
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        schedule: {
          type: scheduleType,
          ...(scheduleType === "every_other_day" && { anchorDate }),
          ...(scheduleType === "days_of_week" && { daysOfWeek }),
          ...(scheduleType === "days_of_month" && { daysOfMonth }),
        },
        gridRange,
        notification: {
          enabled: notifEnabled,
          time: notifTime,
        },
      };

      try {
        const url = isEdit ? `/api/habits/${habit._id}` : "/api/habits";
        const method = isEdit ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          onSave(data);
        }
      } catch {
        // silently fail
      } finally {
        setSaving(false);
      }
    },
    [
      name,
      description,
      color,
      icon,
      scheduleType,
      anchorDate,
      daysOfWeek,
      daysOfMonth,
      gridRange,
      notifEnabled,
      notifTime,
      saving,
      isEdit,
      habit,
      onSave,
    ]
  );

  const handleArchive = useCallback(async () => {
    if (!habit) return;
    try {
      await fetch(`/api/habits/${habit._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt: new Date().toISOString() }),
      });
      onArchive?.();
    } catch {
      // silently fail
    }
  }, [habit, onArchive]);

  const handleDelete = useCallback(async () => {
    if (!habit) return;
    try {
      const res = await fetch(`/api/habits/${habit._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete?.();
      }
    } catch {
      // silently fail
    }
  }, [habit, onDelete]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="habit-name">Name *</Label>
        <Input
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Exercise, Read, Meditate"
          required
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="habit-desc">Description</Label>
        <Input
          id="habit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="habit-icon">Icon (emoji)</Label>
        <Input
          id="habit-icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="e.g. 🏃‍♂️"
          className="w-20"
        />
      </div>

      {/* Color picker */}
      <div className="flex flex-col gap-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {HABIT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setColor(c.hex)}
              className={cn(
                "size-8 rounded-full transition-all",
                color === c.hex
                  ? "ring-2 ring-offset-2 ring-offset-background"
                  : "hover:scale-110"
              )}
              style={{
                backgroundColor: c.hex,
                ...(color === c.hex ? { ringColor: c.hex } : {}),
              }}
              aria-label={c.name}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Schedule type */}
      <div className="flex flex-col gap-1.5">
        <Label>Schedule</Label>
        <div className="flex flex-wrap gap-1">
          {(
            Object.entries(SCHEDULE_LABELS) as [ScheduleType, string][]
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setScheduleType(type)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                scheduleType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Days of Week */}
      {scheduleType === "days_of_week" && (
        <div className="flex flex-col gap-1.5">
          <Label>Select days</Label>
          <div className="flex gap-1.5">
            {DOW_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDayOfWeek(i)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  daysOfWeek.includes(i)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Days of Month */}
      {scheduleType === "days_of_month" && (
        <div className="flex flex-col gap-1.5">
          <Label>Select dates</Label>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDayOfMonth(day)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                  daysOfMonth.includes(day)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Every Other Day anchor */}
      {scheduleType === "every_other_day" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="anchor-date">Anchor date</Label>
          <Input
            id="anchor-date"
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The habit will be scheduled every other day starting from this date.
          </p>
        </div>
      )}

      <Separator />

      {/* Grid range */}
      <div className="flex flex-col gap-1.5">
        <Label>Activity grid range</Label>
        <Select
          value={gridRange}
          onValueChange={(val) => setGridRange(val as number)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            {GRID_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notification */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="notif-toggle">Notification</Label>
          <Switch
            id="notif-toggle"
            checked={notifEnabled}
            onCheckedChange={(checked) => setNotifEnabled(checked)}
          />
        </div>
        {notifEnabled && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notif-time">Reminder time</Label>
            <Input
              id="notif-time"
              type="time"
              value={notifTime}
              onChange={(e) => setNotifTime(e.target.value)}
              className="w-32"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!name.trim() || saving}>
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Habit"}
        </Button>

        {isEdit && (
          <>
            <Dialog>
              <DialogTrigger
                render={
                  <Button type="button" variant="outline" className="w-full" />
                }
              >
                Archive Habit
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive this habit?</DialogTitle>
                  <DialogDescription>
                    The habit will be hidden from your dashboard. You can restore
                    it later from Settings.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button variant="destructive" onClick={handleArchive}>
                    Archive
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger
                render={
                  <Button type="button" variant="destructive" className="w-full" />
                }
              >
                Delete Habit
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Permanently delete this habit?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete the habit and all its entries.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </form>
  );
}
