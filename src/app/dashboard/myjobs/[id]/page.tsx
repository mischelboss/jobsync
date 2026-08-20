import {
  getJobDetails,
  getJobSourceList,
  getStatusList,
} from "@/actions/job.actions";
import JobDetails from "@/components/myjobs/JobDetails";
import { getAllCompanies } from "@/actions/company.actions";
import { getAllJobTitles } from "@/actions/jobtitle.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllTags } from "@/actions/tag.actions";
import { getInterviewPrep } from "@/actions/interview-prep.actions";
import { notFound } from "next/navigation";

async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [
    { job },
    statuses,
    companies,
    titles,
    locations,
    sources,
    tags,
    prepRes,
  ] = await Promise.all([
    getJobDetails(id),
    getStatusList(),
    getAllCompanies(),
    getAllJobTitles(),
    getAllJobLocations(),
    getJobSourceList(),
    getAllTags(),
    // Read here rather than in the section: the agent chat saves this
    // server-side and calls router.refresh(), which re-runs this page but
    // cannot re-trigger a client effect that has already hydrated once.
    getInterviewPrep(id),
  ]);

  // A link to a job that was deleted (or never belonged to this user) would
  // otherwise crash JobDetails on the first job.* read.
  if (!job) notFound();

  return (
    <div className="col-span-3">
      <JobDetails
        job={job}
        jobStatuses={statuses}
        companies={companies}
        titles={titles}
        locations={locations}
        sources={sources}
        tags={tags ?? []}
        interviewPrep={prepRes?.success ? (prepRes.data ?? null) : null}
      />
    </div>
  );
}

export default JobDetailsPage;
