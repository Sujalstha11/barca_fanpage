import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Contracts from './pages/Contracts.jsx'
import Fixtures from './pages/Fixtures.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import Results from './pages/Results.jsx'
import Squad from './pages/Squad.jsx'
import Standings from './pages/Standings.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="fixtures" element={<Fixtures />} />
          <Route path="results" element={<Results />} />
          <Route path="standings" element={<Standings />} />
          <Route path="squad" element={<Squad />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
