import { useState, useEffect } from 'react'
import axios from 'axios'
import confetti from 'canvas-confetti'
import toast, { Toaster } from 'react-hot-toast'
import { FileText, X, Flame } from 'lucide-react'
import './DailyTaskChecklist.css'

function DailyTaskChecklist({ fullView }) {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user._id) fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`/api/student/daily-tasks/${user._id}`)
      // Map API task.name to task.text for compatibility with existing UI if needed, but we'll adapt the UI slightly
      setTasks(res.data.tasks || [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleTask = async (index) => {
    const updated = tasks.map((t, i) => i === index ? { ...t, completed: !t.completed } : t)
    const wasAllCompleted = tasks.every(t => t.completed)
    setTasks(updated)
    try {
      const res = await axios.post(`/api/student/daily-tasks/${user._id}`, {
        date: new Date().toISOString(),
        tasks: updated
      })

      setTasks(res.data.tasks || updated)

      if (res.data.allCompleted && !wasAllCompleted) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        })
        toast.success(
          (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Tasks completed! Streak updated! <Flame size={16} strokeWidth={2} />
            </span>
          ),
          { position: 'bottom-right' }
        )
      }
    } catch (err) {
      console.error('Failed to update tasks:', err)
      toast.error("Failed to update task")
    }
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return
    const updated = [...tasks, { name: newTask, category: 'Custom', completed: false }]
    setTasks(updated)
    setNewTask('')
    try {
      const res = await axios.post(`/api/student/daily-tasks/${user._id}`, {
        date: new Date().toISOString(),
        tasks: updated
      })
      setTasks(res.data.tasks || updated)
    } catch (err) {
      console.error('Failed to add task:', err)
    }
  }
  
  const deleteTask = async (index) => {
    const updated = tasks.filter((_, i) => i !== index)
    setTasks(updated)
    try {
      const res = await axios.post(`/api/student/daily-tasks/${user._id}`, {
        date: new Date().toISOString(),
        tasks: updated
      })
      setTasks(res.data.tasks || updated)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  return (
    <div className={`daily-tasks-widget ${fullView ? 'full' : ''}`}>
      <Toaster />
      <div className="tasks-header">
        <h3><FileText size={18} strokeWidth={2} style={{ verticalAlign: '-3px' }} /> Today's Tasks</h3>
        <span className="tasks-progress-text">{completedCount}/{totalCount} Completed</span>
      </div>
      
      <div className="tasks-progress">
        <div className="tasks-progress-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="tasks-list">
        {tasks.map((task, i) => (
          <div key={task._id || i} className={`task-item ${task.completed ? 'completed' : ''}`}>
            <label className="task-label">
              <input type="checkbox" checked={task.completed} onChange={() => toggleTask(i)} />
              <span className="task-custom-check"></span>
              <span className="task-text">{task.name || task.text}</span>
            </label>
            {fullView && <button className="task-delete" onClick={() => deleteTask(i)} aria-label="Delete task"><X size={16} strokeWidth={2} /></button>}
          </div>
        ))}
      </div>

      <form className="task-add-form" onSubmit={addTask}>
        <input 
          type="text" 
          value={newTask} 
          onChange={(e) => setNewTask(e.target.value)} 
          placeholder="Add a new task..." 
        />
        <button type="submit">+</button>
      </form>
    </div>
  )
}

export default DailyTaskChecklist
