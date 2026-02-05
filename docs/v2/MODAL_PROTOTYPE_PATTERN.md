# Modal Prototype Pattern - Add Event Modal

## Overview
The calendar Add Event modal demonstrates the ideal modal pattern for Angel OS. This should be used as the prototype for all other modal controls (todos, file management, etc.).

## Key Features of the Prototype

### 1. **Clean Dialog Structure**
```tsx
<Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
  <DialogTrigger asChild>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Add Event
    </Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>{isEditMode ? "Edit Event" : "Add New Event"}</DialogTitle>
      <DialogDescription>
        {isEditMode ? "Update event details" : "Create a new calendar event"}
      </DialogDescription>
    </DialogHeader>
    {/* Form content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSaveEvent}>{isEditMode ? "Update" : "Save"}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 2. **Form Layout Pattern**
- **Grid layouts** for related fields (start/end date, start/end time)
- **Proper spacing** with `gap-4` and `py-4`
- **Label/Input pairs** with clear hierarchy
- **Select components** for categorization
- **Textarea** for longer descriptions

### 3. **State Management Pattern**
```tsx
const [isDialogOpen, setIsDialogOpen] = useState(false)
const [isEditMode, setIsEditMode] = useState(false)
const [formData, setFormData] = useState<FormType>({
  // Default values
})

const handleSave = () => {
  if (formData.requiredField) {
    if (isEditMode) {
      // Update logic
    } else {
      // Create logic
    }
    setIsDialogOpen(false)
    setIsEditMode(false)
    resetForm()
  }
}

const handleEdit = (item: ItemType) => {
  setFormData(item)
  setIsEditMode(true)
  setIsDialogOpen(true)
}
```

### 4. **Visual Design Elements**
- **Consistent spacing**: `p-4`, `gap-4`, `space-y-4`
- **Proper borders**: `border-b`, `border-t`
- **Theme-aware colors**: Uses CSS variables
- **Rounded corners**: `rounded-lg`, `rounded-md`
- **Hover states**: `hover:bg-muted/50`
- **Transitions**: `transition-colors`

## Application to Other Controls

### Todo Modal
```tsx
<Dialog open={isTodoDialogOpen} onOpenChange={setIsTodoDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{isEditMode ? "Edit Task" : "Add New Task"}</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Task Title</Label>
        <Input id="title" value={todoData.title} onChange={...} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={todoData.description} onChange={...} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={todoData.priority} onValueChange={...}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" type="date" value={todoData.dueDate} onChange={...} />
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsTodoDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleSaveTodo}>{isEditMode ? "Update" : "Save"}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### File Manager Modal
```tsx
<Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>File Details</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="alt">Alt Text</Label>
        <Input id="alt" value={fileData.alt} onChange={...} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="caption">Caption</Label>
        <Textarea id="caption" value={fileData.caption} onChange={...} />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsFileDialogOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDeleteFile}>Delete</Button>
      <Button onClick={handleUpdateFile}>Update</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Best Practices from the Prototype

1. **Consistent button placement**: Cancel on left, primary action on right
2. **Proper form validation**: Check required fields before saving
3. **Clear mode indication**: Edit vs Create modes with different titles
4. **Responsive design**: `sm:max-w-[425px]` for mobile compatibility
5. **Accessible labels**: Proper `htmlFor` attributes
6. **Loading states**: Disable buttons during operations
7. **Error handling**: Show validation errors inline
8. **Auto-focus**: Focus first input when modal opens

## Integration with Message System

All modals should integrate with the message system by:
1. Storing data as structured messages with appropriate `messageType`
2. Using the `content.systemData` field for structured data
3. Adding proper metadata for filtering and searching
4. Maintaining audit trails through message history


