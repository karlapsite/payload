import type { I18nClient } from '@payloadcms/translations'
import type { Metadata } from 'next'
import type { ImportMap, MappedComponent, SanitizedConfig } from 'payload'

import { formatAdminURL, getCreateMappedComponent, RenderComponent } from '@payloadcms/ui/shared'
import { notFound, redirect } from 'next/navigation.js'
import React, { Fragment } from 'react'

import { DefaultTemplate } from '../../templates/Default/index.js'
import { MinimalTemplate } from '../../templates/Minimal/index.js'
import { initPage } from '../../utilities/initPage/index.js'
import { getViewFromConfig } from './getViewFromConfig.js'

export { generatePageMetadata } from './meta.js'

export type GenerateViewMetadata = (args: {
  config: SanitizedConfig
  i18n: I18nClient
  isEditing?: boolean
  params?: { [key: string]: string | string[] }
}) => Promise<Metadata>

export const RootPage = async ({
  config: configPromise,
  importMap,
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  readonly config: Promise<SanitizedConfig>
  readonly importMap: ImportMap
  readonly params: Promise<{
    segments: string[]
  }>
  readonly searchParams: Promise<{
    [key: string]: string | string[]
  }>
}) => {
  const config = await configPromise

  const {
    admin: {
      routes: { createFirstUser: _createFirstUserRoute },
      user: userSlug,
    },
    routes: { admin: adminRoute },
  } = config

  const params = await paramsPromise
  const currentRoute = formatAdminURL({
    adminRoute,
    path: `${Array.isArray(params.segments) ? `/${params.segments.join('/')}` : ''}`,
  })

  const segments = Array.isArray(params.segments) ? params.segments : []

  const searchParams = await searchParamsPromise

  const { DefaultView, initPageOptions, templateClassName, templateType } = getViewFromConfig({
    adminRoute,
    config,
    currentRoute,
    importMap,
    searchParams,
    segments,
  })

  let dbHasUser = false

  const initPageResult = await initPage(initPageOptions)

  if (typeof initPageResult?.redirectTo === 'string') {
    redirect(initPageResult.redirectTo)
  }

  if (initPageResult) {
    dbHasUser = await initPageResult?.req.payload.db
      .findOne({
        collection: userSlug,
        req: initPageResult?.req,
      })
      ?.then((doc) => !!doc)

    const createFirstUserRoute = formatAdminURL({ adminRoute, path: _createFirstUserRoute })

    const collectionConfig = config.collections.find(({ slug }) => slug === userSlug)
    const disableLocalStrategy = collectionConfig?.auth?.disableLocalStrategy

    if (currentRoute === createFirstUserRoute && (disableLocalStrategy || dbHasUser)) {
      redirect(adminRoute)
    }

    if (currentRoute !== createFirstUserRoute && !dbHasUser && !disableLocalStrategy) {
      redirect(createFirstUserRoute)
    }
  }

  if (!DefaultView?.Component && !DefaultView?.payloadComponent) {
    notFound()
  }

  const createMappedView = getCreateMappedComponent({
    importMap,
    serverProps: {
      i18n: initPageResult?.req.i18n,
      importMap,
      initPageResult,
      params,
      payload: initPageResult?.req.payload,
      searchParams,
    },
  })

  const MappedView: MappedComponent = createMappedView(
    DefaultView.payloadComponent,
    undefined,
    DefaultView.Component,
    'createMappedView',
  )

  const RenderedView = <RenderComponent mappedComponent={MappedView} />

  return (
    <Fragment>
      {!templateType && <Fragment>{RenderedView}</Fragment>}
      {templateType === 'minimal' && (
        <MinimalTemplate className={templateClassName}>{RenderedView}</MinimalTemplate>
      )}
      {templateType === 'default' && (
        <DefaultTemplate
          i18n={initPageResult?.req.i18n}
          locale={initPageResult?.locale}
          params={params}
          payload={initPageResult?.req.payload}
          permissions={initPageResult?.permissions}
          searchParams={searchParams}
          user={initPageResult?.req.user}
          visibleEntities={{
            // The reason we are not passing in initPageResult.visibleEntities directly is due to a "Cannot assign to read only property of object '#<Object>" error introduced in React 19
            // which this caused as soon as initPageResult.visibleEntities is passed in
            collections: initPageResult?.visibleEntities?.collections,
            globals: initPageResult?.visibleEntities?.globals,
          }}
        >
          {RenderedView}
        </DefaultTemplate>
      )}
    </Fragment>
  )
}
